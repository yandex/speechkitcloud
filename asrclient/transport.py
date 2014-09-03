import socket
import select
import time


class TransportError(RuntimeError):
    def __init__(self, message):
        RuntimeError.__init__(self, message)


class Transport:
    def __init__(self, ip, port, timeout=5, verbose=True):
        self.verbose = verbose
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.settimeout(timeout)
        if self.verbose:
            print 'Socket created' + str(self.socket)
        tries = 5
        while True:
            try:
                if self.verbose:
                    print 'Trying to connect ' + ip + ":" + str(port)
                self.socket.connect((ip, port))
                break
            except Exception as ex:
                tries -= 1
                time.sleep(1)
                if (tries == 0):
                    raise ex

    def __enter__(self):
        return self

    def send(self, data):
        while True:
            rlist, wlist, xlist = select.select([], [self.socket], [self.socket], 0.1)

            if len(xlist):
                raise TransportError("send unavailable!")

            if len(wlist):
                break

        self.socket.send(data)

    def recv(self, length):
        while True:
            rlist, wlist, xlist = select.select([self.socket], [], [self.socket], 0.1)

            if len(xlist):
                raise TransportError("recv unavailable!")

            if len(rlist):
                break

        return self.socket.recv(length)

    def sendMessage(self, message):
        self.socket.send(hex(len(message))[2:])
        self.socket.send('\r\n')
        self.socket.send(message)

    def recvMessage(self):
        size = ''
        while True:
            symbol = self.recv(1)

            if len(symbol) == 0:
                raise TransportError("Socket is already closed from the other side!")

            assert len(symbol) == 1

            if symbol == '\r':
                self.socket.recv(1)
                break
            else:
                size += symbol
        sizeInt = int('0x' + size, 0)
        if self.verbose:
            print "Got message. Expecting {0} bytes length.".format(sizeInt)
        if (sizeInt > 0):
            result = ''
            while len(result) < sizeInt:
                result += self.recv(sizeInt - len(result))

            assert(len(result) == sizeInt)
            return result

        return ''

    def sendProtobuf(self, protobuf):
        self.sendMessage(protobuf.SerializeToString())

    def recvProtobuf(self, protobufType):
        response = protobufType()
        message = self.recvMessage()

        response.ParseFromString(message)

        return response

    def recvProtobufIfAny(self, protobuf):
        rlist, wlist, xlist = select.select([self.socket], [], [self.socket], 0)
        if (len(rlist)):
            return self.recvProtobuf(protobuf)
        else:
            return None

    def transfer(self, sendProtobuf, receiveType):
        self.sendProtobuf(sendProtobuf)
        return self.recvProtobuf(receiveType)

    def close(self):
        if self.verbose:
            print 'Close socket' + str(self.socket)
        self.socket.close()

    def __exit__(self, type, value, traceback):
        self.close()
