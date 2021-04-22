"use strict"

class BIMHistory {

    constructor() {
        console.log("bim_history.js loaded...");
    }

    init() {
        parent = this;
        console.log("init()");
        parent.init_popup(parent);
        parent.history_el = document.getElementById('history');
        parent.handle_history(parent, API_BIM_HISTORY["history"]);
    }

    // Sort API_SENSOR_HISTORY by `acp_ts` timestamp (newest first)
    sort_history(parent, api_history) {
        api_history.sort(function(a,b) {
            let a_datetime = parent.make_date(a["acp_ts"]);
            let b_datetime = parent.make_date(b["acp_ts"]);
            return b_datetime - a_datetime;
        });
    }

    // Will handle the return jsonobject from the sensors API request
    // Note full history is  [ API_SENSOR_INFO ] append API_SENSOR_HISTORY
    handle_history(parent, api_history) {
        console.log("handle_history");

        try {
            parent.sort_history(parent, api_history);
        } catch (e) {
            console.log("handle_history sort exception");
            api_history = [];
        }

        let history_length = 0;
        try {
            history_length = api_history.length;
        } catch {
            history_length = 0;
        }
        console.log('history_length=',history_length);

        if (history_length == 0) {
            let error_div = document.createElement('div');
            error_div.className = 'error_div';
            let error_text = 'An error occurred - no metadata found for this sensor type.';
            error_div.appendChild(document.createTextNode(error_text));
            parent.history_el.appendChild(error_div);
            return;
        }

        let history_table = document.createElement('table');
        history_table.className = 'history_table';

        let history_index = 1;

        let current_info = api_history[0];

        do {
            let previous_info = null;

            if (history_index < history_length) {
                previous_info = api_history[history_index];
                history_index++;
            }

            parent.history_add_row(history_table, current_info, previous_info);

            current_info = previous_info;

        } while (current_info != null);

        parent.history_el.appendChild(history_table);
    }

    // Add a new row to the history page
    // previous_record is needed for the 'diff' column
    history_add_row(history_el, record, previous_record) {
        // Newest record is API_SENSOR_INFO
        let record_el = document.createElement('tr');
        record_el.className = "history_record";

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
        ts_el.className = "history_ts";

        let datetime = parent.make_date(record['acp_ts']);

        let date_str = parent.format_date(datetime); // YYYY-MM-DD

        ts_el.innerText = date_str;

        record_el.appendChild(ts_el);
    }

    history_add_diff(record_el, record, previous_record) {
        let diff_el = document.createElement('td');
        diff_el.className = "history_diff";
        record_el.appendChild(diff_el);

        if (record==null || previous_record==null) {
            return;
        }

        for (let property_name in record) {
            if (!(property_name in previous_record)) {
                let prop_el = document.createElement('div');
                prop_el.className = "history_diff_prop_pos";
                prop_el.innerText = '+'+property_name;
                diff_el.appendChild(prop_el);
            }
        }

        for (let property_name in previous_record) {
            if (!(property_name in record)) {
                let prop_el = document.createElement('div');
                prop_el.className = "history_diff_prop_neg";
                prop_el.innerText = '-'+property_name;
                diff_el.appendChild(prop_el);
            }
        }
    }

    history_add_commit_comment(record_el, record) {
        let comment_el = document.createElement('td');
        comment_el.className = "history_comment";

        let person_el = document.createElement('td');
        person_el.className = "history_person";

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
        record_el.className = 'history_record_selected';
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
        record_el.className = "history_record";
        parent.popup_el.style.display = "none";
    }

} // end class SensorHistory
