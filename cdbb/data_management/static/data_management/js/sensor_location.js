"use strict"

class Sensor {

    constructor() {
        console.log("sensor_edit.js loading...");
    }

    init() {
        parent = this;
        console.log("init()");
        parent.sensor_info_el = document.getElementById('sensor_info');
        parent.type_info_el = document.getElementById('type_info');
        parent.type_heading_type_el = document.getElementById('type_heading_type');
        parent.get_sensor_metadata(parent);
    }

    // Use API_SENSORS to retrieve requested sensor metadata
    get_sensor_metadata(parent) {
        let sensor_metadata_url = API_SENSORS + 'get/' + ACP_ID + '/';
        let request = new XMLHttpRequest();
        request.overrideMimeType('application/json');

        request.addEventListener("load", function () {
          let sensor_metadata = JSON.parse(request.responseText)
          parent.handle_sensor_metadata(parent, sensor_metadata);
        });
        console.log("sensor.js requesting "+sensor_metadata_url);
        request.open("GET", sensor_metadata_url);
        request.send();
    }

    // Will handle the return jsonobject from the sensors API request
    handle_sensor_metadata(parent, sensor_metadata) {
        console.log("handle_sensor_metadata got", sensor_metadata);

        delete sensor_metadata.acp_type_info;

        // Display the Sensor Metadata jsonobject
        let sensor_metadata_txt = JSON.stringify(sensor_metadata, null, 2);
        let sensor_el = document.createElement('pre');
        sensor_el.id = 'sensor_metadata';
        sensor_el.innerHTML = this.escapeHTML(sensor_metadata_txt);
        parent.sensor_info_el.appendChild(sensor_el);
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

} // end class Sensor
