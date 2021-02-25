"use strict"

class SensorEdit {

    constructor() {
        console.log("sensor.js loading...");
    }

    init() {
        parent = this;
        console.log("init()");
        parent.sensor_info_el = document.getElementById('sensor_info');
        parent.handle_sensor_metadata(parent, SENSOR_METADATA);
    }

    // Will handle the return jsonobject from the sensors API request
    handle_sensor_metadata(parent, sensor_metadata) {
        console.log("handle_sensor_metadata got", sensor_metadata);

        // Delete the type info returned by the API
        delete sensor_metadata.acp_type_info;

        // Display the Sensor Metadata jsonobject
        let sensor_metadata_txt = JSON.stringify(sensor_metadata, null, 2);
        parent.sensor_info_el.value = sensor_metadata_txt;
    }

    escapeHTML(str) {
        return str.replace(/[&<>'"]/g,
          tag => ({
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              "'": '&#39;',
              '"': '&quot;'
            }[tag]));
    }

} // end class SensorEdit
