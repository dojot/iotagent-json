# iotagent-json

[![License badge](https://img.shields.io/badge/license-GPL-blue.svg)](https://opensource.org/licenses/GPL-3.0)
[![Docker badge](https://img.shields.io/docker/pulls/dojot/iotagent-json.svg)](https://hub.docker.com/r/dojot/iotagent-json/)
[![Travis badge](https://travis-ci.org/dojot/iotagent-json.svg?branch=cpqd_master)](https://travis-ci.org/dojot/iotagent-json#)

IoT agents are responsible for receiving messages from physical devices (directly or through a gateway) and sending them commands in order to configure them. This iotagent-json, in particular, receives messages via MQTT with JSON payloads.

## How does it work

iotagent-json depends on two things: a Kafka broker, so that it can receive messages informing it about new devices (and, in extension, about their updates and removals), and a MQTT broker, so that it can receive messages from the devices. It waits for messages sent through these two elements: from the device manager with a management operation on a device and from the MQTT broker with a message sent by a device.

### MQTT

MQTT is a somewhat simple protocol: it follows a publish/subscriber paradigm and messages are exchanged using topics. These topics are simple strings such as "/admin/cafe/attrs". A publisher can, well, publish messages by sending them to a MQTT broker using a particular topic and all the subscribers that are listening to that topic will receive a copy of the message.

Subscribers can listen not only to specific topics, but also to topics with wildcards. For instance, one could use a '+' to indicate that any token will match the subscribed topic, such as "/admin/+/attrs" - messages sent to both "/admin/cafe/attrs" and "/admin/4593/attrs", for instance, will be received by this subscriber. Another possibility is to create a subscription to all remainder tokens in the topic, such as "/admin/#". All messages sent to topics beginning with "/admin/" will be received by this subscriber.

### Kafka

Kafka is, in fact, a project from the [Apache Foundation](https://kafka.apache.org). It is a messaging system that is similar to MQTT in the sense that both are based on publisher/subscriber. Kafka is way more complex and robust - it deals with multiple subscribers belonging to the same group (and performs load-balancing between them), stores and replays messages, and so on. The side effect is that its clients are not that simple, which could be a heavy burden for tiny devices.

### Receiving messages from the device manager via Kafka

There are two types of messages supported:

```json
{
  "event": "create",
  "meta": {
    "service": "admin"
  },
  "data": {
    "id": "cafe",
    "attrs" : {

    }
  }
}
```

The "event" field can have any of these values (for this message format):  "create", "update" or "remove".

The 'attrs' subfield is the same as the one sent to DeviceManager. Visit [this link](https://dojot.github.io/device-manager/concepts.html) to check out its format. The other format is quite similar - it's used to send configurations to devices.

```json
{
  "event": "configure",
  "meta": {
    "topic": "/admin/cafe/attrs",
    "id": "cafe"
  },
  "data": {
    "id": "cafe"
  },
  "device-attr1": "value"
}
```

This request will send a message containing this request to the device.

### Receiving messages from devices via MQTT

Any message payload sent to iotagent-json must be in JSON format. Preferably, they should follow a simple key-value structure, such as:

```json
{
  "speed": 100.0,
  "weight": 50.2,
  "id": "truck-001"
}
```

But, if not desired or feasible, this can be a little more flexible. Its structure should allow the construction of a simple key-value list. For instance, let's suppose that your device emits the following message:

```json
{
  "data": {
    "first_": {
      "temperature": {
        "type": "float",
        "value": 10.5
      },
      "pressure": {
        "type": "float",
        "value": 750
      }
    }
  }
}
```

This allows the following structure to be constructed:

```json
{
  "temperature": 10.5,
  "pressure": 750
}
```

which is ok. This transformation is done by "translator" instructions associated to the device, which are explained in detail in other document.

## Configuration

iotagent-json configuration is pretty simple. The main and only configuration file is ```config.json```, placed at the repository root directory. For instance, the default
configuration file looks like:

```json
{
  "mqtt": {
    "host": "mqtt",
    "port" : 1883,
    "protocolId": "MQIsdp",
    "protocolVersion": 3,
    "secure": false,
    "tls": {
      "key": "certs/iotagent.key",
      "cert": "certs/iotagent.crt",
      "ca": [ "certs/ca.crt" ],
      "version": "TLSv1_2_method"
    }
  },
  "broker": {
    "host": "orion:1026",
    "type": "orion"
  },
  "device_manager": {
    "kafkaHost" : "zookeeper:2181",
    "kafkaOptions": {
      "autoCommit": true,
      "fetchMaxWaitMs" : 1000,
      "fetchMaxBytes" : 1048576,
      "groupId" : "iotagent"
    },
    "kafkaTopics": [
        { "topic": "dojot.device-manager.device" }
      ]
  }
}
```

There are four things to configure:

- MQTT: where the device messages will come from.
- MQTT Security: if used (and you should be using), these are the things that must be configured. They are related to the communication between iotagent-json and the physical device.
- Data broker: where to send device information updates. There is support for Kafka (sending a message to every component that is interested in device updates) and for Orion (context broker from Fiware project).
- Device manager access: how the device manager will send device notifications to iotagent (creation, update and removal).

Check [dojot's documentation](http://dojotdocs.readthedocs.io/en/latest/) if you don't know or don't remember all the components and how and why they communicate to each other.

## How to build

As this is a npm-based project, building it is as simple as

```bash
npm install
npm run-script build
```

If everything runs fine, the generated code should be in ```./build``` folder.

## How to run

As simple as:

```bash
npm run-script start ./config.json
```

Remember that you should already have a Kafka node (with a zookeeper instance) and a MQTT broker (such as [Eclipse's mosquitto](https://mosquitto.org))

### How do I know if it is working properly?

Simply put: you won't. In fact you can implement a simple Kafka publisher to emulate the behaviour of a device manager instance and a listener to check what messages it is generating. But it seems easier to get the real components - they are not that hard to start and to use (given that you use dojot's [docker-compose](https://github.com/dojot/docker-compose)). Check also [device manager documentation](https://dojot.github.io/device-manager/) for further information about how to create a new device.
