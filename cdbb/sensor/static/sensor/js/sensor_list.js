"use strict"

// Template provides API_SENSORS

class SensorList {

    constructor() {
        console.log("sensor_list.js loading...");
    }

    init() {
        parent = this;
        console.log("init()");
        parent.sensor_list_el = document.getElementById('sensor_list');
        parent.get_sensor_list(parent);
    }

    // Use API_SENSORS to retrieve requested sensor metadata
    get_sensor_list(parent) {
        let sensor_list_url = API_SENSORS + 'list/?type_metadata=true';
        let request = new XMLHttpRequest();
        request.overrideMimeType('application/json');

        request.addEventListener("load", function () {
          let sensor_list = JSON.parse(request.responseText)
          parent.handle_sensor_list(parent, sensor_list);
        });
        console.log("sensor_list.js requesting "+sensor_list_url);
        request.open("GET", sensor_list_url);
        request.send();
    }

    // Will handle the return jsonobject from the sensors API request
    handle_sensor_list(parent, sensor_list) {
        console.log("handle_sensor_list got", sensor_list);

        // Display the Sensor List jsononbject
        let sensor_list_txt = JSON.stringify(sensor_list, null, 2);
        parent.sensor_list_el.innerHTML = "<pre>" + this.escapeHTML(sensor_list_txt) + "</pre>";
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
