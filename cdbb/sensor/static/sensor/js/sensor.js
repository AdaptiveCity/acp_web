"use strict"

class Sensor {

    constructor() {
        console.log("sensor.js loading...");
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

        let type_info  = {};
        // clone "acp_type_info" into its own jsonobject and remove from sensor_metadata
        try {
            type_info = JSON.parse(JSON.stringify(sensor_metadata["acp_type_info"]));
        } catch (err) {
            console.log("handle_sensor_metadata parse error for acp_type_info");
        }
        delete sensor_metadata.acp_type_info;

        // Display the Sensor Metadata jsonobject
        let sensor_metadata_txt = JSON.stringify(sensor_metadata, null, 2);
        parent.sensor_info_el.innerHTML = "<pre>" + this.escapeHTML(sensor_metadata_txt) + "</pre>";

        // Add the acp_type_id as a heading on the type_info section
        parent.type_heading_type_el.innerHTML = sensor_metadata.acp_type_id;

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

} // end class Sensor
