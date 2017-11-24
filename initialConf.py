#!/usr/bin/python
# this script makes the initial configuration to use TLS with iotagent
# it generates the iotagent key pair and retrieves
# a certificate and CRL from CA
# if the configuration has already been done before, this script does nothing

import conf
import os
import binascii
from OpenSSL import crypto
import certUtils
from time import sleep
import requests


def generateKeys():
    if not os.path.isfile(conf.certsDir + 'iotagent.key'):
        certUtils.generatePrivateKey(conf.certsDir + "/iotagent.key",
                                     conf.keyLength)
        print "iotagent key pair created"


def generateCSR():
    if not os.path.isfile(conf.certsDir + "/iotagent.csr"):
        certUtils.generateCSR(CName='iotagent',
                              privateKeyFile=conf.certsDir + "/iotagent.key",
                              csrFileName=conf.certsDir + "/iotagent.csr",
                              dnsname=['iotagent', 'localhost'])


def askCertSign():
    if not os.path.isfile(conf.certsDir + "/iotagent.crt"):
        passwd = binascii.b2a_hex(os.urandom(16))
        try:
            certUtils.createEJBCAUser(conf.EJBCA_API_URL,
                                      conf.CAName, "iotagent", passwd)
        except certUtils.EJBCARESTException as err:
            print("Cant create EJBCA user. Error: " + err.message)
            exit(-1)
        try:
            cert = certUtils.signCert(conf.EJBCA_API_URL,
                                      conf.certsDir + "/iotagent.csr",
                                      "iotagent", passwd)
        except certUtils.EJBCARESTException as err:
            print("Cant sign the CRT. EJBCA-REST return code: " + err.message)
            exit(-1)
        certUtils.saveCRT(conf.certsDir + "/iotagent.crt", cert)
        print("iotagent certificate signed")


def retrieveCAChain():
    if not os.path.isfile(conf.certsDir + "/ca.crt"):
        try:
            rawCrt = certUtils.retrieveCAChain(conf.EJBCA_API_URL, conf.CAName)
            certUtils.saveCRT(conf.certsDir + "/ca.crt", rawCrt)
            print("CA certificates retrieved")
        except KeyError:
            print "Invalid answer returned from EJBCA."
            exit(-1)


def retrieveCRL():
    if not os.path.isfile(conf.certsDir + "/ca.crl"):
        try:
            rawCRL = certUtils.retrieveCACRL(conf.EJBCA_API_URL, conf.CAName)
            certUtils.saveCRL(conf.certsDir + "/ca.crl", rawCRL)
        except KeyError:
            print "Invalid answer returned from EJBCA."
            exit(-1)
        except crypto.Error:
            print("Could not decode retrieved CRL")
            exit(-1)


if __name__ == '__main__':
    while True:
        try:
            retrieveCAChain()
            generateKeys()
            generateCSR()
            askCertSign()
            # retrieveCRL()
            break
        except requests.exceptions.ConnectionError:
            print("Cant connect to EJBCA server at "
                  + conf.EJBCA_API_URL + " for initial configuration")
            print("Chances are the server is not ready yet."
                  " Will retry in 30sec")
            sleep(30)
    exit(0)
