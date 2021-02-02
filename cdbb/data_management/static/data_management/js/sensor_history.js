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

    history_add_ts(record_el, record) {
        let ts_el = document.createElement('div');
        ts_el.className = "sensor_history_ts";

        let datetime = parent.make_date(record['acp_ts']);

        let date_str = parent.format_date(datetime); // YYYY-MM-DD

        ts_el.innerText = date_str;

        record_el.appendChild(ts_el);
    }

    history_add_user_comment(record_el, record) {
        let comment_el = document.createElement('div');
        comment_el.className = "sensor_history_comment";

        let user_el = document.createElement('div');
        user_el.className = "sensor_history_user";

        let acp_user_id = null;
        let acp_user_name = null;
        let user_str = '';
        let comment_str = '';

        if (record.hasOwnProperty("acp_commit")) {
            if (record["acp_commit"].hasOwnProperty("comment")) {
                comment_str = record["acp_commit"]["comment"]
            }
            if (record["acp_commit"].hasOwnProperty("acp_user_id")) {
                acp_user_id = record["acp_commit"]["acp_user_id"]
            }
            if (record["acp_commit"].hasOwnProperty("acp_user_name")) {
                acp_user_name = record["acp_commit"]["acp_user_name"]
            }
            user_str = acp_user_id ? acp_user_id : '';
            user_str += acp_user_name ? (acp_user_id ? '/' : '') + acp_user_name : ''
        }

        user_el.innerText = user_str;
        record_el.appendChild(user_el);

        comment_el.innerText = comment_str;
        record_el.appendChild(comment_el);
    }

    history_add_row(history_el, record) {
        // Newest record is API_SENSOR_INFO
        let record_el = document.createElement('div');
        record_el.className = "sensor_history_record";
        record_el.onclick = function(el) { parent.show_popup(parent, record); };

        // acp_ts
        parent.history_add_ts(record_el, record);

        // acp_commit->comment, acp_user_id, acp_user_name
        parent.history_add_user_comment(record_el, record);

        // ***
        // Add this record to the displayed history
        history_el.appendChild(record_el);
    }

    // Will handle the return jsonobject from the sensors API request
    handle_sensor_history(parent) {
        console.log("handle_sensor_history");

        parent.sort_history(parent);

        // Create DOM object to hold this history list
        let sensor_history_el = document.getElementById('sensor_history');

        // First display CURRENT sensor_info as top of history
        parent.history_add_row(sensor_history_el, API_SENSOR_INFO);

        // Previous records are in API_SENSOR_HISTORY (ordered by decreasing datetime)
        for (let sensor_info of API_SENSOR_HISTORY) {
            parent.history_add_row(sensor_history_el, sensor_info);
        }
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
        var d = new Date(date),
            month = '' + (d.getMonth() + 1),
            day = '' + d.getDate(),
            year = d.getFullYear();

        if (month.length < 2)
            month = '0' + month;
        if (day.length < 2)
            day = '0' + day;

        return [year, month, day].join('-');
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
        document.getElementById('popup_close').onclick = function(el) {parent.hide_popup(parent);};
    }

    // show_popup is called when a history record is clicked
    show_popup(parent, d) {
        parent.popup_el.style.display = 'block';
        var content = document.getElementById("popup_content");
        content.innerHTML = JSON.stringify(d, null, 4);
    }

    hide_popup(parent) {
        console.log("popup hide")
        parent.popup_el.style.display = "none";
    }

} // end class SensorHistory
