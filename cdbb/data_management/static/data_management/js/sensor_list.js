"use strict"

// Template provides:
//   API_SENSORS - url for the sensors API
//   SENSOR_LINK - page link for the "sensor" page, with string "acp_id" where the acp_id should go (see code below).
//   SENSOR_TYPE_LINK - page link for the "sensor type" page, with "acp_type_id" to be replaced with required id.
//
// Note the API call returns { 'sensors': [ list of sensors, each with property acp_type_id ]
//                             'types': [ list of sensor type info for the sensors returned ]
//                           }
// Currently the /list/ API is designed to return *all* the sensors, which will be fine for <1000 sensors, but
// in future we will add a filter capability to the API.

class SensorList {

    constructor() {
        console.log("sensor_list.js loading...");
    }

    init() {
        parent = this;
        console.log("init()");
        parent.sensor_list_el = document.getElementById('sensor_list');
        parent.sensor_list_table_el = document.getElementById('sensor_list_table');

        let input_el = document.getElementById('list_search_input');

        input_el.addEventListener('keyup', event => {
            let filter_string = input_el.value.toUpperCase();
            parent.filter_table( parent.sensor_list_table_el, filter_string);
        });

        // Now we make the Sensors API call, to get the required data
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

        // We will convert the sensor_list['types'] list into an object for easier lookup.
        let types_obj = sensor_list['types'];

        // Display the Sensor List jsononbject
        //let sensor_list_txt = JSON.stringify(sensor_list, null, 2);
        //parent.sensor_list_el.innerHTML = "<pre>" + this.escapeHTML(sensor_list_txt) + "</pre>";
        let sensors = sensor_list["sensors"];

        // Contruct and append the table heading row.
        let heading_tr = parent.make_heading();
        parent.sensor_list_table_el.appendChild(heading_tr);

        // Construct and append the row for each sensor
        let even_row = true; // for color of row
        for (let acp_id in sensors) {
            let sensor = sensors[acp_id];
            // make_row will return a 'tr' element containing the sensor info
            let sensor_row = parent.make_row(sensor, types_obj);
            sensor_row.className = even_row ? "even_row" : "odd_row";
            even_row = !even_row;
            parent.sensor_list_table_el.appendChild(sensor_row);
        }
    }

    // Return a 'tr' for the heading of the display table
    make_heading() {
        let heading_tr = document.createElement('tr');
        heading_tr.className = 'sensor_list_header';

        let acp_id_th = document.createElement('th');
        acp_id_th.className = 'sensor_list_acp_id';
        acp_id_th.textContent = 'acp_id';
        heading_tr.appendChild(acp_id_th);

        let acp_type_id_th = document.createElement('th');
        acp_type_id_th.className = 'sensor_list_acp_type_id';
        acp_type_id_th.textContent = 'acp_type_id';
        heading_tr.appendChild(acp_type_id_th);

        let date_th = document.createElement('th');
        date_th.className = 'sensor_list_date';
        date_th.textContent = 'Date Added';
        heading_tr.appendChild(date_th);

        let features_th = document.createElement('th');
        features_th.className = 'sensor_list_features';
        features_th.textContent = 'Features';
        heading_tr.appendChild(features_th);

        return heading_tr;
    }

    // Contruct a 'tr' DOM object for a sensor
    make_row(sensor, types_obj) {
        let sensor_tr = document.createElement('tr');

        // ACP_ID (sensor identifier)
        let acp_id_td = document.createElement('td');
        let acp_id_a = document.createElement('a');
        acp_id_a.href = SENSOR_LINK.replace('acp_id', sensor['acp_id']); // cunning eh?
        acp_id_a.textContent = sensor['acp_id'];
        acp_id_td.appendChild(acp_id_a);
        sensor_tr.appendChild(acp_id_td);

        // ACP_TYPE_ID (sensor type identifier)
        let acp_type_id_td = document.createElement('td');
        let acp_type_id_a = document.createElement('a');
        acp_type_id_a.href = SENSOR_TYPE_LINK.replace('acp_type_id', sensor['acp_type_id']);
        acp_type_id_a.textContent = sensor['acp_type_id'];
        acp_type_id_td.appendChild(acp_type_id_a);
        sensor_tr.appendChild(acp_type_id_td);

        // DATE
        let date_td = document.createElement('td');
        let js_date = new Date(parseFloat(sensor['acp_ts']*1000));
        let date_str = js_date.getFullYear() + '-' +
                       ('0' + (js_date.getMonth() + 1)).slice(-2) + '-' +
                       ('0' + js_date.getDate()).slice(-2)
        date_td.textContent = date_str;
        sensor_tr.appendChild(date_td);

        // FEATURES (such as temperature, humidity, co2)
        // Make a 'td' containing e.g. "temperature,humidity" from the sensor.features array
        let features_td = parent.make_features(sensor, types_obj);
        sensor_tr.appendChild(features_td);

        return sensor_tr
    }

    // Get comma-separated string of feature names for a given sensor
    // Sensor has property 'acp_type_id' which is lookup into the types info that was also returned by the API.
    make_features(sensor, types_obj) {
        console.log('make_features() given',types_obj);
        let features_txt = '';
        if ('acp_type_id' in sensor) {
            let acp_type_id = sensor['acp_type_id'];
            if (acp_type_id in types_obj) {
                let sensor_type_info = types_obj[acp_type_id]; // This lookup was the point of having 'types_obj'.
                let sensor_features = sensor_type_info['features']; // list of features.
                let first = true; // just for the comma
                for (const feature_id in sensor_features) {
                    if (!first) {
                        features_txt += ', ';
                    }
                    features_txt += sensor_features[feature_id]['name'];
                    first = false;
                }
            } else {
                features_txt = 'type undefined';
            }
        } else {
            features_txt = 'sensor undefined';
        }
        let sensor_td = document.createElement('td');
        sensor_td.textContent = features_txt;
        return sensor_td;
    }

    // Filter rows (via display="" or display="none") if they match words in user_filter
    filter_table(table_element, user_filter) {
        console.log('filtering on '+user_filter);
        let filter_words = user_filter.split(' '); // multiple words separated by spaces
        let rows = table_element.getElementsByTagName("tr");
        // Loop through all table rows, and hide those who don't match the search query
        for (let i = 1; i < rows.length; i++) {
            let row = rows[i];
            let cells = row.getElementsByTagName("td");
            let hide_row = false; // We will hide row if it doesn't contain *any* filter word
            let row_text = '';
            // Accumulate text from whole row into row_text
            for (let j = 0; j < cells.length; j++) {
                let cell = cells[j]
                row_text += cell.textContent || cell.innerText;
            }
            // Now check that *all* filter words appear in row_text
            for (let filter_word of filter_words) {
                //DEBUG support multiple words
                if (row_text.toUpperCase().indexOf(filter_word) == -1) {
                    hide_row = true; // if filter word is missing, flag this row to be hidden
                    break;
                }
            }
            if (hide_row) {
                row.style.display = "none";
            } else {
                row.style.display = "";
            }
        }
    }

    // Return str with HTML special chars converted, e.g. '>' -> '&gt;'
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
