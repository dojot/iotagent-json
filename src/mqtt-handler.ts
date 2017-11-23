import mqtt = require("mqtt");
import fs = require("fs");
import config = require("./config");
import { ConfigOptions } from "./config";

interface MqttTlsConfig {
  protocol?: 'mqtts';
  port?: number;
  password?: string;
  key?: string
  cert?: string
  ca?: string[];
  passphrase?: string;
  secureProtocol?: string;
  protocolId?: string;
  protocolVersion?: number;
}

// Configuration data used mqtt.connect function
interface MqttConfig {
  options?: MqttTlsConfig;
  url: string;
}

function buildMqttParameters(config: ConfigOptions) : MqttConfig {
  let ret: MqttConfig = { url : "" };

  let protocol = "";
  // Read TLS configuration
  if ((config.mqtt.secure == true) && (config.mqtt.tls != undefined)) {
    ret.options = {
      key: fs.readFileSync(config.mqtt.tls.key, "utf8"),
      cert: fs.readFileSync(config.mqtt.tls.cert, "utf8"),
      ca: <string[]>[],
      // This should be removed from here ASAP
      passphrase: "cpqdiot2017",
      secureProtocol: config.mqtt.tls.version,
      port: config.mqtt.port,
      protocol: "mqtts"
    }
    for (var i = 0; i < config.mqtt.tls.ca.length; i++) {
      // The ! indicates that the variable is not undefined.
      ret.options.ca!.push(fs.readFileSync(config.mqtt.tls.ca[i], 'utf8'));
    }
    if (config.mqtt.protocolId != undefined) {ret.options.protocolId = config.mqtt.protocolId;}
    if (config.mqtt.protocolVersion != undefined) {ret.options.protocolVersion = config.mqtt.protocolVersion;}

    protocol = 'mqtts://';
  } else {
    protocol = 'mqtt://';
  }

  ret.url = protocol + config.mqtt.host + ':' + config.mqtt.port;

  return ret;
}

function stop(client: mqtt.Client, callback: (error: Error) => void) {
  let subscribeOptions: mqtt.ClientSubscribeOptions = {};
  client.unsubscribe("#", subscribeOptions, function (error: any) {
    if (error) {
      console.log('Could not unsubscribe from "#" topic: ' + error);
      callback(error);
    }
    console.log('... unsubscribed.');
  });
}

function start(config: ConfigOptions, messageCallback: (topic: string, message:string) => void, callback: (error: Error) => void): mqtt.Client {
  console.log('Connecting to broker...');
  let mqttConfig = buildMqttParameters(config);
  let mqttClient = mqtt.connect(mqttConfig.url, mqttConfig.options);
  console.log('... connected.');

  console.log('Registering callbacks...');
  mqttClient.on('message', messageCallback);
  mqttClient.on('connect', function () {
    console.log('Subscribing to all topics...');
    let topic: mqtt.Topic = {"#" : 0};
    let subscribeOptions: mqtt.ClientSubscribeOptions = {};
    mqttClient.subscribe(topic, subscribeOptions, function (error: any) {
      if (error) {
        console.log('Could not subscribe to "#" topic: ' + error);
        callback(error);
      }
      console.log('... subscribed.');
    });
  });
  console.log('... callbacks registered.');
  console.log('... MQTT connection configured.');

  return mqttClient;
}


export {start};
export {stop};
