import socket
import select
import sys
import time
import ssl
import pprint


class TransportError(RuntimeError):
    def __init__(self, message):
        RuntimeError.__init__(self, message)


class Transport:
    def __init__(self, ip, port, timeout=8, verbose=True, enable_ssl=False, ipv4=False, max_faults=0):
        self.verbose = verbose
        self.max_faults = max_faults
        tries = 5
        while tries > 0:
            try:
                if self.verbose:
                    print('Trying to connect %s:%s' % (ip, port))
                    print("Tries left: %s" % (tries,))
                if enable_ssl:
                    s = socket.socket(socket.AF_INET if ipv4 else socket.AF_INET6, socket.SOCK_STREAM)
                    ssl_sock = ssl.wrap_socket(s)
                    ssl_sock.connect((ip, port))
                    print(repr(ssl_sock.getpeername()))
                    print(ssl_sock.cipher())
                    print(pprint.pformat(ssl_sock.getpeercert()))
                    self.socket = ssl_sock
                else:
                    self.socket = socket.create_connection((ip, port), timeout)
                    self.socket.settimeout(timeout)
                return None
            except Exception as ex:
                tries -= 1
                time.sleep(1)
                if (tries == 0):
                    raise ex

    def __enter__(self):
        return self

    def send(self, data):
        faults = 0

        while True:
            try:
                rlist, wlist, xlist = select.select([], [self.socket], [self.socket], 0.1)
                if len(xlist):
                    raise TransportError("send unavailable!")
                if len(wlist):
                    break
            except Exception as e:
                if self.verbose:
                    print("Exception on pre-send select: ", e)
                faults += 1
                if faults > self.max_faults:
                    raise e
        while True:
            try:
                self.socket.send(data.encode("utf-8") if (sys.version_info[0] == 3 and type(data) == str) else data)
                break
            except Exception as e:
                if self.verbose:
                    print("Exception on send: ", e)
                faults += 1
                if faults > self.max_faults:
                    raise e
        if self.verbose:
            print("Send " + str(len(data)))

    def recv(self, length, decode=(sys.version_info[0] == 3)):
        res = b""
        faults = 0
        while True:
            try:
                res += self.socket.recv(length - len(res))
                if len(res) < length:
                    rlist, _, xlist = select.select([self.socket], [], [self.socket], 0.1)
                else:
                    if decode:
                        return res.decode("utf-8")
                    else:
                        return res
            except Exception as e:
                if self.verbose:
                    print("Exception on recv: ", e)
                faults += 1
                if faults > self.max_faults:
                    raise e

    def sendFull(self, message):
        begin = 0
        while begin < len(message):
            begin += self.socket.send(message[begin:])

    def sendMessage(self, message):
        self.socket.send(hex(len(message))[2:].encode("utf-8"))
        self.socket.send(b'\r\n')
        self.sendFull(message)
        if self.verbose:
            print("Send message size: ", len(message))

    def recvMessage(self):
        size = b''
        while True:
            symbol = self.socket.recv(1)

            if len(symbol) == 0:
                raise TransportError('Backend closed connection')

            assert(len(symbol) == 1), 'Bad symbol len from socket ' + str(len(symbol))

            if symbol == b'\r':
                self.socket.recv(1)
                break
            else:
                size += symbol
        sizeInt = int(b'0x' + size, 0)
        if self.verbose:
            print("Got message. Expecting {0} bytes length.".format(sizeInt))
        if (sizeInt > 0):
            result = b''
            while len(result) < sizeInt:
                result += self.socket.recv(sizeInt - len(result), False)
            result = result
            assert (len(result) == sizeInt), 'Invalid message size'
            return result
        return ''

    def sendProtobuf(self, protobuf):
        self.sendMessage(protobuf.SerializeToString())

    def recvProtobuf(self, *protobufTypes):
        savedException = None

        message = self.recvMessage()
        for protoType in protobufTypes:
            response = protoType()
            try:
                response.ParseFromString(message)
                return response
            except Exception as exc:
                savedException = exc

        raise savedException

    def recvProtobufIfAny(self, *protobuf):
        rlist, wlist, xlist = select.select([self.socket], [], [self.socket], 0)
        if (len(rlist)):
            return self.recvProtobuf(*protobuf)
        else:
            return None

    def transfer(self, sendProtobuf, receiveType):
        self.sendProtobuf(sendProtobuf)
        return self.recvProtobuf(receiveType)

    def close(self):
        if self.verbose:
            print('Close socket' + str(self.socket))
        self.socket.close()

    def __exit__(self, type, value, traceback):
        self.close()

server = "127.0.0.1"
port = 8089


def defaultHost():
    return "{0}:{1}".format(server, port)


def defaultTransport():
    return Transport(server, port, verbose=False)
