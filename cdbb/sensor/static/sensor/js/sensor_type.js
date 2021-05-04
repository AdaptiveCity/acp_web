"use strict"

// Template provides ACP_TYPE_ID, API_SENSORS_INFO

class SensorType {

    constructor() {
        console.log("sensor_type.js loading...");
    }

    init() {
        parent = this;
        console.log("init()");
        parent.type_info_el = document.getElementById('type_info');
        parent.handle_type_info(parent, API_SENSORS_INFO);
    }

    // Will handle the return jsonobject from the sensors API request
    handle_type_info(parent, type_info) {
        console.log("handle_type_info got", type_info);

        // Display the Sensor Type jsononbject
        let type_txt = JSON.stringify(type_info, null, 2);
        parent.type_info_el.innerHTML = "<pre>" + this.escapeHTML(type_txt) + "</pre>";
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

} // end class SensorType
