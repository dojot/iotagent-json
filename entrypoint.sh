#!/bin/sh
cd /opt/iotagent-json/
python initialConf.py
if [ $? -ne 0 ]; then
    echo "Error ocurred on initial iotagent TLS setup"
    return -1
fi

npm start ./config.json
