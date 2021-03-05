"use strict"

class SensorMetadata {

    constructor() {
        console.log("sensor.js loading...");
    }

    init() {
        parent = this;
        console.log("init()");
        parent.sensor_info_el = document.getElementById('sensor_info');
        parent.type_info_el = document.getElementById('type_info');
        parent.type_info_heading_el = document.getElementById('type_info_heading');
        parent.handle_sensor_metadata(parent, SENSOR_METADATA);
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
        let sensor_el = document.createElement('pre');
        sensor_el.id = 'sensor_metadata';
        sensor_el.innerHTML = this.escapeHTML(sensor_metadata_txt);
        parent.sensor_info_el.appendChild(sensor_el);

        // Display the Sensor Type Metadata object

        let type_id = sensor_metadata.acp_type_id;

        // Create HTML link to sensor type page.
        // This is SENSOR_TYPE_LINK provided in the template, with 'acp_type_id' replaced with the required string value.
        let type_link = SENSOR_TYPE_LINK.replace('acp_type_id', type_id);

        let type_heading_txt = '<a href="'+type_link+'"/>Sensor type metadata: '+type_id+'</a>';

        // Add the acp_type_id as a heading on the type_info section
        parent.type_info_heading_el.innerHTML = type_heading_txt;

        let type_txt = JSON.stringify(type_info, null, 2);
        let type_el = document.createElement('pre');
        type_el.id = 'sensor_type_metadata';
        type_el.innerHTML = this.escapeHTML(type_txt);
        parent.type_info_el.appendChild(type_el);
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

} // end class SensorMetadata
