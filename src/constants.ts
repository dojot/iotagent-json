class Constants {
  // Attribute type for iotagent-json configuration attributes
  static CONFIGURATION_TYPE = "meta";

  // Attribute type for iotagent-json actuation attributes
  static ACTUATOR_TYPE = "actuator";

  // Attribute type for translator instructions.
  static TRANSLATOR_TYPE = "meta-translator";

  // Attribute label for ID location configuration (type should be 
  // CONFIGURATION_TYPE)
  static ID_LOCATION_LABEL = "id-location";

  // Topic to which the device will publish its data (type should be 
  // CONFIGURATION_TYPE)
  static MQTT_TOPIC_LABEL = "topic";

  // Topic to which actuation messages will be sent (type should be 
  // CONFIGURATION_TYPE)
  static MQTT_ACTUATE_TOPIC_LABEL = "topic-config";

  static Kakfa = {
    CREATE_EVENT: "create",
    REMOVE_EVENT: "remove",
    UPDATE_EVENT: "update",
    ACTUATE_EVENT: "actuate"
  }
}

export {Constants}