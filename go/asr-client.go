package main

import (
	"bufio"
	"bytes"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"strconv"

	"github.com/golang/protobuf/proto"

	"github.com/yandex/speechkitcloud/go/BasicProtobuf"
	"github.com/yandex/speechkitcloud/go/VoiceProxyProtobuf"
)

type Debug bool

func (d Debug) Printf(s string, a ...interface{}) {
	if d {
		log.Printf(s, a...)
	}
}

var dbg Debug

func sendData(conn io.Writer, data []byte) int {
	written1, err := fmt.Fprintf(conn, "%x\r\n", len(data))
	check("sendData / fmt.Fprintf", err)

	written2, err := conn.Write(data)
	check("sendData / conn.Write", err)
	return written1 + 2 + written2
}

func sendProtoMessage(conn io.Writer, message proto.Message) int {
	data, err := proto.Marshal(message)
	check("sendProtoMessage / proto.Marshal", err)
	written := sendData(conn, data)
	return written
}

func recvData(connReader *bufio.Reader) []byte {
	resp, err := connReader.ReadString('\n')
	check("recvData / connReader.ReadString", err)
	if len(resp) < 2 {
		log.Fatal("recvData / no length line found")
	}

	connRespProtoLength, err := strconv.ParseInt(resp[:len(resp)-2], 16, 64)
	check("recvData / strconv.ParseInt", err)

	dbg.Printf(">> 0x%s -> %d\n", resp[:len(resp)-2], int(connRespProtoLength))

	buffer := make([]byte, int(connRespProtoLength))
	_, err = io.ReadFull(connReader, buffer)
	check("recvData / io.ReadFull", err)
	return buffer
}

func recvProtoMessage(connReader *bufio.Reader, message proto.Message) {
	err := proto.Unmarshal(recvData(connReader), message)
	check("recvProtoMessage / proto.Unmarshal ", err)
}

func check(id interface{}, err error) {
	if err != nil {
		log.Fatal(id, err)
	}
}

func main() {
	serverPtr := flag.String("s", "asr.yandex.net", "ASR server to connect.")
	portPtr := flag.Int("p", 80, "Server port.")
	apiKeyPtr := flag.String("k", "069b6659-984b-4c5f-880e-aaedcfd84102",
		"Speechkit Cloud api key. You should get your own at https://developer.tech.yandex.ru.\n\r\tDefault is limited demo key.")
	topicPtr := flag.String("topic", "freeform", "Recognition model topic (aka \"model\").")
	formatPtr := flag.String("format", "audio/x-pcm;bit=16;rate=16000", "Input file format.")
	langPtr := flag.String("lang", "ru-RU", "Recognition language. ru-RU | en-EN | tr-TR | uk-UA.")
	verbosePtr := flag.Bool("verbose", false, "Print more debug output.")
	chunkSizePtr := flag.Int("chunk-size", 32768, "Client chops input file into chunks and sends it one-by-one in a streaming manner.\n\rDefault value roughly equals to one second of audio in default format.")

	flag.Parse()

	dbg = Debug(*verbosePtr)

	if len(flag.Args()) == 0 {
		log.Fatal("No input file!")
	}

	fileName := flag.Args()[0]

	connectionString := fmt.Sprintf("%v:%v", *serverPtr, *portPtr)
	dbg.Printf(connectionString)

	conn, err := net.Dial("tcp", connectionString)
	check(1, err)
	defer conn.Close()

	var upgradeRequest bytes.Buffer
	upgradeRequest.WriteString("GET /asr_partial HTTP/1.1\r\n")
	upgradeRequest.WriteString("Upgrade: dictation\r\n\r\n")

	dbg.Printf("%s", upgradeRequest.String())
	_, err = upgradeRequest.WriteTo(conn)
	check(3, err)

	reader := bufio.NewReader(conn)

	resp, err := reader.ReadString('\n')
	for resp != "" {
		check(4, err)
		dbg.Printf(resp)
		if resp == "\r\n" {
			break
		}
		resp, err = reader.ReadString('\n')
	}

	dbg.Printf(">> done reading upgrade response, trying to send protobuf\n")

	initProto := &VoiceProxyProtobuf.ConnectionRequest{
		ApiKey:           proto.String(*apiKeyPtr),
		SpeechkitVersion: proto.String(""),
		ServiceName:      proto.String(""),
		Device:           proto.String("desktop"),
		Coords:           proto.String("0, 0"),
		Uuid:             proto.String("12345678123456788765432187654321"),
		ApplicationName:  proto.String("golang-client"),
		Topic:            proto.String(*topicPtr),
		Lang:             proto.String(*langPtr),
		Format:           proto.String(*formatPtr),
	}

	sendProtoMessage(conn, initProto)

	connRespProto := &BasicProtobuf.ConnectionResponse{}
	recvProtoMessage(reader, connRespProto)

	dbg.Printf(">> done reading connection response proto\n")
	dbg.Printf(">> connRespProto { %v}\n", connRespProto)

	f, err := os.Open(fileName)
	check(10, err)
	defer f.Close()
	fileInfo, err := f.Stat()
	check(12, err)

	var chunkSize int64 = int64(*chunkSizePtr)
	expectedChunksCount := int32(fileInfo.Size() / chunkSize)
	if fileInfo.Size()%chunkSize != 0 {
		expectedChunksCount++ // last chunk is probably < chunkSize
	}
	expectedChunksCount++ // final empty chunk

	go func() {
		var chunkCount int
		chunkBuff := make([]byte, chunkSize)
		for err == nil {
			var readCount int
			readCount, err = f.Read(chunkBuff)
			dbg.Printf(">> read chunk %d\n", readCount)
			if readCount > 0 {
				dbg.Printf(">> sending chunk %d\n", chunkCount)
				addDataProto := &VoiceProxyProtobuf.AddData{LastChunk: proto.Bool(false), AudioData: chunkBuff}
				sendProtoMessage(conn, addDataProto)
				chunkCount++
			}
		}
		lastChunkProto := &VoiceProxyProtobuf.AddData{LastChunk: proto.Bool(true)}
		sendProtoMessage(conn, lastChunkProto)
	}()

	var loopCounter int32
	for err == nil && loopCounter < expectedChunksCount {
		dbg.Printf(">> recv proto loop %v/%v\n", loopCounter, expectedChunksCount)
		addDataRespProto := &VoiceProxyProtobuf.AddDataResponse{}
		recvProtoMessage(reader, addDataRespProto)
		dbg.Printf(">> addDataRespProto { %v}\n", addDataRespProto)

		if err == nil {
			loopCounter += addDataRespProto.GetMessagesCount()
			dbg.Printf(">> loopCounter increased, now %v/%v\n", loopCounter, expectedChunksCount)
			recognitions := addDataRespProto.GetRecognition()
			if len(recognitions) > 0 {
				fmt.Printf("got result: %v; endOfUtt: %v\n", addDataRespProto.GetRecognition()[0].GetNormalized(), addDataRespProto.GetEndOfUtt())
			}
		}
	}

	fmt.Printf("Done, all fine!\n")
}
