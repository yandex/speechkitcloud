import socket
import select
import time
import ssl
import pprint

class TransportError(RuntimeError):
    def __init__(self, message):
        RuntimeError.__init__(self, message)

class Transport:
    def __init__(self, ip, port, timeout=25, verbose=True, enable_ssl = False, ipv4 = False):
        self.verbose = verbose
        tries = 5
        while tries > 0:
            try:
                if self.verbose:
                    print 'Trying to connect ' + ip + ":" + str(port)
                    print "Tries left: " + str(tries)
                if enable_ssl:
                    s = socket.socket(socket.AF_INET if ipv4 else socket.AF_INET6, socket.SOCK_STREAM)
                    ssl_sock = ssl.wrap_socket(s)
                    ssl_sock.connect((ip, port))
                    print repr(ssl_sock.getpeername())
                    print ssl_sock.cipher()
                    print pprint.pformat(ssl_sock.getpeercert())
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
        while True:
            rlist, wlist, xlist = select.select([], [self.socket], [self.socket], 0.1)
            if len(xlist):
                raise TransportError("send unavailable!")
            if len(wlist):
                break
        self.socket.send(data)
        if self.verbose:
            print "Send " + str(len(data))
            print data

    def recv(self, length):
        # TODO: findout why not working with SSL sockets
        # while True:
        #     rlist, wlist, xlist = select.select([self.socket], [], [self.socket], 0.1)
        #     if len(xlist):
        #         raise TransportError("recv unavailable!")
        #     if len(rlist):
        #         break
        return self.socket.recv(length)

    def sendFull(self, message):
        begin = 0
        while begin < len(message):
            begin += self.socket.send(message[begin:])
            
    def sendMessage(self, message):
        self.socket.send(hex(len(message))[2:])
        self.socket.send('\r\n')
        self.sendFull(message)
        if self.verbose:
            print "Send message size: ", len(message)

    def recvMessage(self):
        size = ''
        while True:
            symbol = self.socket.recv(1)

            if len(symbol) == 0:
                raise TransportError('Backend closed connection (may be you behaived badly?)')

            assert(len(symbol) == 1), 'Bad symbol len from socket ' + str(len(symbol))

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
                result += self.socket.recv(sizeInt - len(result))
            assert (len(result) == sizeInt), 'Invalid message size'
            return result;
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

server = "127.0.0.1"
port = 8089

def defaultHost():
    return "{0}:{1}".format(server, port)

def defaultTransport():
    return Transport(server, port, verbose = False)
