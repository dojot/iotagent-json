FROM node:8

WORKDIR /opt/iotagent-json
ENV MQTT_TLS="false"
RUN apt-get update \
    && apt-get install -y python-pip \
    &&  pip install pyopenssl

COPY . /opt/iotagent-json/
RUN npm install && npm run-script build

RUN chmod +x /opt/iotagent-json/entrypoint.sh \
    && mkdir /opt/iotagent-json/certs

CMD ["/opt/iotagent-json/entrypoint.sh"]
