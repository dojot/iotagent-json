#!/bin/sh
cd /opt/iotagent-json/

CONFIG_FILE=${1:-'config.json'}

if [ "${MQTT_TLS}" = "true" ] ; then
  python initialConf.py
  if [ $? -ne 0 ]; then
      echo "Error ocurred on initial iotagent TLS setup"
      return -1
  fi
fi

npm start ${CONFIG_FILE}
