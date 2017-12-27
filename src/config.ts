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

export {ConfigOptions};
