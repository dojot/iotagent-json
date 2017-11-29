FROM node:8

COPY . /opt/iotagent-json/
WORKDIR /opt/iotagent-json

RUN apt-get update \
    && apt-get install -y python-pip \
    &&  pip install pyopenssl

RUN npm install && npm run-script build

RUN chmod +x /opt/iotagent-json/entrypoint.sh \
    && mkdir /opt/iotagent-json/certs

CMD ["/opt/iotagent-json/entrypoint.sh"]
