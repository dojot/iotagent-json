# configuration file
import os

APIport = 9010


EJBCA_API_URL = os.environ.get("EJBCA_API_URL", "http://ejbca:5583")

CAName = os.environ.get("CA_NAME", "IOTmidCA")

keyLength = int(os.environ.get("KEY_LENGTH", 4096))

certsDir = "/opt/iotagent-json/certs/"
