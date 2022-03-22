"use strict"

// Template provides:
//   API_PEOPLE_INFO - metadata from the people API
//   PERSON_LINK - page link for the "person" page, with string "person_id" where the person_id should go (see code below).
//
// Note the API call returns { 'people': { dict of people }
//                             'insts': { dict of insts }
//                           }
// Currently the /list/ API is designed to return *all* the people, which will be fine for <1000 people, but
// in future we will add a filter capability to the API.

class PersonList {

    constructor() {
        console.log("person_list.js loading...");
    }

    init() {
        parent = this;
        console.log("init()");
        parent.person_list_el = document.getElementById('person_list');
        parent.person_list_table_el = document.getElementById('person_list_table');

        let input_el = document.getElementById('list_search_input');

        input_el.addEventListener('keyup', event => {
            let filter_string = input_el.value.toUpperCase();
            parent.filter_table( parent.person_list_table_el, filter_string);
        });

        // Now we make the people API call, to get the required data
        parent.handle_person_list(parent, API_PEOPLE_INFO);
    }

    // Will handle the return jsonobject from the people API request
    handle_person_list(parent, person_list) {
        console.log("handle_person_list got", person_list);

        // We will convert the person_list['types'] list into an object for easier lookup.
        let insts_obj = person_list['insts_info'];

        // Display the person List jsononbject
        //let person_list_txt = JSON.stringify(person_list, null, 2);
        //parent.person_list_el.innerHTML = "<pre>" + this.escapeHTML(person_list_txt) + "</pre>";
        let people = person_list["people_info"];

        // Contruct and append the table heading row.
        let heading_tr = parent.make_heading();
        parent.person_list_table_el.appendChild(heading_tr);

        // Construct and append the row for each person
        let even_row = true; // for color of row
        for (let person_id in people) {
            let person = people[person_id];
            // make_row will return a 'tr' element containing the person info
            let person_row = parent.make_row(person, insts_obj);
            person_row.className = even_row ? "even_row" : "odd_row";
            even_row = !even_row;
            parent.person_list_table_el.appendChild(person_row);
        }
    }

    // Return a 'tr' for the heading of the display table
    make_heading() {
        let heading_tr = document.createElement('tr');
        heading_tr.className = 'person_list_header';

        let person_id_th = document.createElement('th');
        person_id_th.className = 'person_list_person_id';
        person_id_th.textContent = 'person_id';
        heading_tr.appendChild(person_id_th);

        let inst_id_th = document.createElement('th');
        inst_id_th.className = 'person_list_inst_id';
        inst_id_th.textContent = 'Institutions';
        heading_tr.appendChild(inst_id_th);

        let bim_th = document.createElement('th');
        bim_th.className = 'person_list_bim';
        bim_th.textContent = 'Office location';
        heading_tr.appendChild(bim_th);

        let date_th = document.createElement('th');
        date_th.className = 'person_list_date';
        date_th.textContent = 'Date Added';
        heading_tr.appendChild(date_th);

        return heading_tr;
    }

    // Contruct a 'tr' DOM object for a person
    make_row(person, insts_obj) {
        let person_tr = document.createElement('tr');

        // person_id (person identifier)
        let person_id_td = document.createElement('td');
        let person_id_a = document.createElement('a');
        person_id_a.href = PERSON_LINK.replace('person_id', person['person_id']); // cunning eh?
        person_id_a.textContent = person['person_id'] + ' ' + person['name'];
        person_id_td.appendChild(person_id_a);
        person_tr.appendChild(person_id_td);

        // insts (person type identifier)
        let insts_td = parent.make_insts(person, insts_obj);
        person_tr.appendChild(insts_td);

        // Building info, e.g. rooms occupied
        // Make a 'td' containing e.g. "temperature,humidity" from the person.bim array
        let bim_td = parent.make_bim(person);
        person_tr.appendChild(bim_td);

        // DATE
        let date_td = document.createElement('td');
        let js_date = new Date(parseFloat(person['acp_ts']*1000));
        let date_str = js_date.getFullYear() + '-' +
                       ('0' + (js_date.getMonth() + 1)).slice(-2) + '-' +
                       ('0' + js_date.getDate()).slice(-2)
        date_td.textContent = date_str;
        person_tr.appendChild(date_td);

        return person_tr
    }

    make_insts(person, insts_obj) {
        let insts_td = document.createElement('td');
        if (person.hasOwnProperty('insts')) {
            for (let inst_id in person['insts']) {
                let inst_name = inst_id;
                if (insts_obj.hasOwnProperty(inst_id) && insts_obj[inst_id].hasOwnProperty['name']) {
                    inst_name = insts_obj[inst_id]['name'];
                };
                let insts_a = document.createElement('a');
                insts_a.className = "person_list_inst";
                insts_a.href = INST_LINK.replace('inst_id', inst_id);
                insts_a.textContent = inst_name;
                insts_td.appendChild(insts_a);
            }
        }
        return insts_td;
    }

    // Get comma-separated string of feature names for a given person
    // person has property 'inst_id' which is lookup into the types info that was also returned by the API.
    make_bim(person) {
        //console.log('make_bim() given',insts_obj);
        let bim_td = document.createElement('td');
        if (person.hasOwnProperty('bim')) {
            for (let crate_id in person['bim']) {
                let bim_a = document.createElement('a');
                bim_a.className = "person_list_bim";
                bim_a.href = BIM_LINK.replace('crate_id', crate_id);
                bim_a.textContent = crate_id;
                bim_td.appendChild(bim_a);
            }
        }
        return bim_td;
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

} // end class personType
