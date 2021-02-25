"use strict"

class SensorHistory {

    constructor() {
        console.log("sensor_history.js loaded...");
    }

    init() {
        parent = this;
        console.log("init()");
        parent.init_popup(parent);
        parent.sensor_history_el = document.getElementById('sensor_history');
        parent.handle_sensor_history(parent);
    }

    // Sort API_SENSOR_HISTORY by `acp_ts` timestamp (newest first)
    sort_history(parent) {
        API_SENSOR_HISTORY.sort(function(a,b) {
            let a_datetime = parent.make_date(a["acp_ts"]);
            let b_datetime = parent.make_date(b["acp_ts"]);
            return b_datetime - a_datetime;
        });
    }

    // Will handle the return jsonobject from the sensors API request
    // Note full history is  [ API_SENSOR_INFO ] append API_SENSOR_HISTORY
    handle_sensor_history(parent) {
        console.log("handle_sensor_history");

        parent.sort_history(parent);

        // Create DOM object to hold this history list
        let sensor_history_el = document.getElementById('sensor_history');

        let history_table = document.createElement('table');
        history_table.className = 'sensor_history_table';

        let history_length = API_SENSOR_HISTORY.length;

        let history_index = 0;

        let current_info = API_SENSOR_INFO;

        do {
            let previous_info = null;

            if (history_index < history_length) {
                previous_info = API_SENSOR_HISTORY[history_index];
                history_index++;
            }

            parent.history_add_row(history_table, current_info, previous_info);

            current_info = previous_info;

        } while (current_info != null);

        sensor_history_el.appendChild(history_table);
    }

    // Add a new row to the history page
    // previous_record is needed for the 'diff' column
    history_add_row(history_el, record, previous_record) {
        // Newest record is API_SENSOR_INFO
        let record_el = document.createElement('tr');
        record_el.className = "sensor_history_record";

        // If user 'clicks' the history record, popup will open and stay open (with close button)
        record_el.onclick = function(el) {
            parent.fix_popup(parent, record_el, record); };

        // If user 'hovers' over the history record, popup will open until mouseout
        record_el.onmouseover = function(el) { parent.popup_popup(parent, record_el, record); };
        record_el.onmouseout = function(el) { parent.unpopup_popup(parent, record_el); };

        // acp_ts
        parent.history_add_ts(record_el, record);

        // Any property changes since previous
        parent.history_add_diff(record_el, record, previous_record);

        // acp_commit->comment, acp_person_id, acp_person_name
        parent.history_add_commit_comment(record_el, record);

        // ***
        // Add this record to the displayed history
        history_el.appendChild(record_el);
    }

    history_add_ts(record_el, record) {
        let ts_el = document.createElement('td');
        ts_el.className = "sensor_history_ts";

        let datetime = parent.make_date(record['acp_ts']);

        let date_str = parent.format_date(datetime); // YYYY-MM-DD

        ts_el.innerText = date_str;

        record_el.appendChild(ts_el);
    }

    history_add_diff(record_el, record, previous_record) {
        let diff_el = document.createElement('td');
        diff_el.className = "sensor_history_diff";
        record_el.appendChild(diff_el);

        if (record==null || previous_record==null) {
            return;
        }

        for (let property_name in record) {
            if (!(property_name in previous_record)) {
                let prop_el = document.createElement('div');
                prop_el.className = "sensor_history_diff_prop_pos";
                prop_el.innerText = '+'+property_name;
                diff_el.appendChild(prop_el);
            }
        }

        for (let property_name in previous_record) {
            if (!(property_name in record)) {
                let prop_el = document.createElement('div');
                prop_el.className = "sensor_history_diff_prop_neg";
                prop_el.innerText = '-'+property_name;
                diff_el.appendChild(prop_el);
            }
        }
    }

    history_add_commit_comment(record_el, record) {
        let comment_el = document.createElement('td');
        comment_el.className = "sensor_history_comment";

        let person_el = document.createElement('td');
        person_el.className = "sensor_history_person";

        let acp_person_id = null;
        let acp_person_name = null;
        let person_str = '';
        let comment_str = '';

        if (record.hasOwnProperty("acp_commit")) {
            if (record["acp_commit"].hasOwnProperty("comment")) {
                comment_str = record["acp_commit"]["comment"]
            }
            if (record["acp_commit"].hasOwnProperty("acp_person_id")) {
                acp_person_id = record["acp_commit"]["acp_person_id"]
            }
            if (record["acp_commit"].hasOwnProperty("acp_person_name")) {
                acp_person_name = record["acp_commit"]["acp_person_name"]
            }
            person_str = acp_person_id ? acp_person_id : '';
            person_str += acp_person_name ? (acp_person_id ? '/' : '') + acp_person_name : ''
        }

        person_el.innerText = person_str;
        record_el.appendChild(person_el);

        comment_el.innerText = comment_str;
        record_el.appendChild(comment_el);
    }

    // Return a javascript Date, given EITHER a UTC timestamp or a ISO 8601 datetime string
    make_date(ts) {
        var t;

        var ts_float = parseFloat(ts);
        if (!Number.isNaN(ts)) {
            t = new Date(ts_float * 1000);
        } else {
            // replace anything but numbers by spaces
            var dt = ts.replace(/\D/g, " ");

            // trim any hanging white space
            dt = dt.replace(/\s+$/, "");

            // split on space
            var dtcomps = dt.split(" ");

            // modify month between 1 based ISO 8601 and zero based Date
            dtcomps[1]--;

            t = new Date(Date.UTC(dtcomps[0], dtcomps[1], dtcomps[2], dtcomps[3], dtcomps[4], dtcomps[5]));
        }
        return t;
    }

    format_date(date) {
        let d = new Date(date);
        let month = ('0' + (d.getMonth() + 1)).slice(-2);
        let day = ('0' + d.getDate()).slice(-2);
        let year = ''+d.getFullYear();
        let hour = ('0'+d.getHours()).slice(-2);
        let minute = ('0'+d.getMinutes()).slice(-2);

        return year+"-"+month+"-"+day+" "+hour+":"+minute;
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

    //*******************************************************************************************************
    //******* POPUP OPEN/CLOSE  *****************************************************************************
    //*******************************************************************************************************

    // Initialiize popup (hidden) called from init()
    init_popup(parent) {
        // Div, initially hidden, pops up to show full record json
        parent.popup_el = document.getElementById('popup');
        parent.popup_close_el = document.getElementById('popup_close');
        parent.popup_fixed = false;
    }

    // popup_popup is called when a history record is hovered over
    popup_popup(parent, record_el, record) {
        if (parent.popup_fixed) {
            return;
        }
        document.getElementById('popup_close').style.display = 'none';
        parent.popup_el.style.display = 'block';
        var content = document.getElementById("popup_content");
        content.innerHTML = JSON.stringify(record, null, 4);
    }

    unpopup_popup(parent, record_el, mouseout) {
        if (parent.popup_fixed) {
            return;
        }
        console.log("popup hide");
        parent.popup_el.style.display = "none";
    }

    // show_popup is called when a history record is clicked
    fix_popup(parent, record_el, record) {
        parent.popup_fixed = true;
        record_el.className = 'sensor_history_record_selected';
        parent.popup_close_el.style.display = 'block';
        parent.popup_close_el.onclick = function (el) {
            parent.unfix_popup(parent, record_el);
        };
        parent.popup_el.style.display = 'block';
        var content = document.getElementById("popup_content");
        content.innerHTML = JSON.stringify(record, null, 4);
    }

    unfix_popup(parent, record_el) {
        console.log("popup unfix");
        parent.popup_fixed = false;
        record_el.className = "sensor_history_record";
        parent.popup_el.style.display = "none";
    }

} // end class SensorHistory
