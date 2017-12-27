// TLS options in configuration file.
interface TlsOptions {
  // File where the private key is.
  // If TLS is used, this attribute is mandatory.
  key: string;
  // File where the certificate is.
  // If TLS is used, this attribute is mandatory.
  cert: string;
  // File where CA (certification authority) certificate is.
  // If TLS is used, this attribute is mandatory.
  ca: Array<string>;
  // TLS version.
  // If TLS is used, this attribute is mandatory.
  version: "TLSv1_2_method" | "TLSv1_method" | "DTLSv1_method" | "DTLSv1_2_method";
}

// MQTT options
interface MqttOptions {
  // MQTT broker address (this attribute doesn't include port).
  host: string;
  // MQTT broker port
  port: number;
  // Protocol ID.
  // Default value is MQIsdp
  protocolId?: string;
  // Protocol version.
  // Default value is 3
  protocolVersion?: number;
  // Flag indicating whether traffic must be encrypted.
  secure: Boolean;
  // Encription configuration.
  // This attribute will be used only if 'secure' is true.
  tls?: TlsOptions;
}


// A simple Kafka topic
interface KafkaTopic {
  topic: string
}

// Kafka configuration
interface KafkaOptions {
  autoCommit: boolean;
  fetchMaxWaitMs: number;
  fetchMaxBytes: number;
  // Kafka group ID
  groupId: string;
}

// Context broker options
interface BrokerOptions {
  // Broker address.
  // This attribute includes port, such as localhost:9092.
  host: string;
  // Broker type.
  // Default value is "orion".
  type?: "orion" | "kafka";
}

// Device manager options
interface DeviceManagerOptions {
  // Device manager address.
  // This attribute includes port, such as localhost:4000.
  host: string;

  // This is which kakfa node is used by device manager to 
  // broadcast its devices updates.
  kafkaHost: string;
  kafkaOptions: KafkaOptions;
  // Topics used by device manager to send notifications
  // about devices
  kafkaTopics: KafkaTopic[];
}
// Main configuration structure
interface ConfigOptions {
  // MQTT options.
  mqtt: MqttOptions;
  // Context broker options.
  broker: BrokerOptions;
  // Device manager options
  device_manager: DeviceManagerOptions;
}

// Build a ConfigOptions object based on a JSON.
function buildConfig(config: any): ConfigOptions {
  let ret: ConfigOptions = config;
  //  = {
  //   mqtt: {
  //     host: config.mqtt.host,
  //     port: config.mqtt.port,
  //     secure: config.mqtt.secure
  //   },
  //   broker: {
  //     host: config.broker.host
  //   },
  //   device_manager: {
  //     host: config.device_manager.host
  //   }
  // }

  // // Adding optional attributes
  // if (config.mqtt.protocolId != undefined) {
  //   ret.mqtt["protocolId"] = config.mqtt.protocolId;
  // }

  // if (config.mqtt.protocolVersion != undefined) {
  //   ret.mqtt["protocolVersion"] = config.mqtt.protocolVersion;
  // }

  // if (config.broker.type != undefined) {
  //   ret.broker["type"] = config.broker.type;
  // } else {
  //   ret.broker["type"] = "orion"
  // }

  // switch (ret.broker.type) {
  //   case "orion":
  //   break;
  //   case "kafka":
  //   if (config.broker.kafka != undefined) {
  //     ret.broker.kafka = {
  //       "autoCommit": config.broker.kafka.autoCommit,
  //       "fetchMaxWaitMs": config.broker.kafka.fetchMaxWaitMs,
  //       "fetchMaxBytes": config.broker.kafka.fetchMaxBytes,
  //       "groupId": config.broker.kafka.groupId,
  //       "deviceNotificationTopic": config.broker.kafka.deviceNotificationTopic
  //     }
  //   }
  //   break;
  // }

  // if (ret.mqtt.secure === true) {
  //   ret.mqtt["tls"] = {
  //     key: config.mqtt.tls.key,
  //     cert: config.mqtt.tls.cert,
  //     ca: config.mqtt.tls.ca,
  //     version: config.mqtt.tls.version
  //   }
  // }
  return ret;
}

export {ConfigOptions, buildConfig};
