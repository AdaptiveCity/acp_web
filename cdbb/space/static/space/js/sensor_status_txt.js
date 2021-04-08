"use strict"

class SensorStatusTxtDisplay {

    // Called to create instance in page : space_floorplan = SpaceFloorplan()
    constructor(master) {
        let self = this;
        //master class (e.g. floorspace) reference
        self.master = master; //can also be undefined

        //make the main div (txt box+svg) invisible before instantiation
        document.getElementById("ssd_main").style.display = "none";

        //a set of useful d3 functions
        self.jb_tools = new VizTools2();

        //counts the numbre of times each asp_id has been triggered
        //e.g. [{'acp_id':zzzzzzz, 'tt':3},...]
        self.msg_history = {};

        self.API_GET_ALL = API_SENSORS + '/list/?type_metadata=true'
        self.API_GET_CRATE = API_SENSORS //https://cdbb.uk/api/sensors/get_bim/WGB/FN07/

        self.sensor_list = [];
        self.sub_list = [];

        self.CIRCLE_RADIUS = 15;
        self.scaling = 60;
        self.columns = 24;
        self.spacing = 25;
        self.margin = 25;
        self.rt_mon = new RTconnect();

        self.sensor_circles = [];
        self.svg_canvas;


        //COLORS AND SIGNS
        self.color_recent_hour = 'rgb(115,195,120)'; //green (active for most recent hour)
        self.color_recent_day = 'rgb(207, 85, 58)'; //red (inactive>24h but <week)
        self.color_recent_week = 'rgb(255,255,255)'; //white (inactive > week)

        self.symbol_inactive = '?'; //inactive for 1 or 2 hours
        self.symbol_dead = 'X'; //inactive for more than 24 hours

        
    }

    // init() called when page loaded#
    //TODO add optional parameters on whether to load the text, circles or both
    init(parent) {

        parent.status_div_id = 'ssd_rt_state';
        parent.txt_div_id = 'ssd_rt';
        parent.timer_short; //the socket has been unactive for a while -- color yellow
        parent.timer_long; //assume the socket connection was lost -- color red

        //check if the ssd class has been instantiated with 
        //a predefined list of sensors to be subscribed to
        if (CRATE_ID != 'None') {

            d3.json(parent.API_GET_ALL, {

                crossOrigin: "anonymous"
            }).then(function (queried_sensor_list) {

                let full_sensor_list=queried_sensor_list.sensors;
                let sensor_list={};

                for(let sensor in full_sensor_list){

                    let sensor_crate=full_sensor_list[sensor].crate_id;
                    if(sensor_crate==CRATE_ID){
                        console.log('yall',full_sensor_list[sensor])
                        sensor_list[sensor] = full_sensor_list[sensor];
                    }

                }
                console.log('the list', sensor_list)


                parent.handle_queried_sensors(parent, sensor_list);
            });

        } else { 
            //else just load all of the sensors available
            d3.json(parent.API_GET_ALL, {
                crossOrigin: "anonymous"
            }).then(function (queried_sensor_list) {
                let sensor_list = queried_sensor_list['sensors'];
                parent.handle_queried_sensors(parent, sensor_list);
            });
        }

        //make the main viz divs (svg+txt) visible
        document.getElementById("ssd_main").style.display = "inline-block";

        //----------------------------------------------------------//
        //--------SET UP EVENT LISTENERS FOR THE VIZ RUNTIME--------//
        //----------------------------------------------------------//
        //  parent.setup_controls(parent);

    }

    

    //checks a list of sensors for their acp_type_ids, draws them on screen
    // and issues a subscription to the rt_monitor client
    handle_queried_sensors(parent, sensor_list) {
        parent.sensor_list = sensor_list;

        console.log('QUERIED SENSORS', sensor_list, 'len', Object.keys(sensor_list).length)

        //TODO parse this using jsonPath or else to look if an acp_type property exists
        parent.sub_list = Object.keys(parent.sensor_list).filter(sensor_object => {

            console.log(sensor_object, parent.sensor_list[sensor_object]['acp_type_id'])

            //if the sensor has a property of acp_type_id, we know it's not a random debug sensor and we're good to go
            if (parent.sensor_list[sensor_object].hasOwnProperty('acp_type_id')) return sensor_object;
        });

        console.log('new len', parent.sub_list.length)

        //connect to the rt_monitor client
        parent.rt_mon.connect(parent.check_status.bind(parent), parent.sub_list);

        //set the start time for the init subscribtion
        parent.today = new Date();
        parent.start_date = document.getElementById('start_time').innerHTML += parent.today.toString().slice(0, 24);

    }

    //close the viz, make divs invisible, remove svg and disconnect rt_client
    close(parent) {
        //disconnect rt client
        //remove svg
        //clear text
        //make main_ssd invisible
    }

    //updates the rtmonitor status icon on the page
    check_status(value, msg) {
        let parent = this;
        // console.log('returned', value, parent)

        //make a switch statement instead
        if (value == '1') {
            document.getElementById(parent.txt_div_id).innerHTML = 'RTm Connected';
            document.getElementById(parent.status_div_id).style.backgroundColor = 'rgb(108, 255, 150)';
            console.log('connected');
        } else if (value == '2') {
            try {
                let msg_data = msg;
                let acp_id = msg.acp_id;
                parent.update_viz(parent, acp_id, msg_data)
            } catch (err) {
                console.log('something went wrong', err)
            }

            //TODO: put timers below in a separate function
            //clear the previous timer since last message
            clearTimeout(parent.timer_short);
            clearTimeout(parent.timer_long);

            //set a short timer to know how long the messages haven't been coming in for
            parent.timer_short = setTimeout(function () {

                console.log('no messages for 5mins', new Date())
                document.getElementById(parent.txt_div_id).innerHTML = 'RTm unresponsive';
                document.getElementById(parent.status_div_id).style.backgroundColor = 'rgb(255, 255, 50)';

            }, 1000 * 60 * 5); //5mins

            //set a long timer to assume that the socket has been dropped
            parent.timer_long = setTimeout(function () {

                console.log('no messages for 15mins', new Date())
                document.getElementById(parent.txt_div_id).innerHTML = 'RTm failed';
                document.getElementById(parent.status_div_id).style.backgroundColor = 'rgb(255, 50, 50)';

            }, 1000 * 60 * 15); //15mins


        } else {}
    }



    update_viz(self, acp_id, msg_data) {


        self.append_text(self, acp_id, msg_data)
    }


    //adds stuff to the text box/to be renamed
    append_text(self, acp_id, msg) {
        //test2['ccc']={'a':'b', 'c':[]}
        //test2.hasOwnProperty("ccc") // true
        let has_happened = self.msg_history.hasOwnProperty(acp_id);
        if (has_happened) {
            self.msg_history[acp_id].pinged = self.msg_history[acp_id].pinged + 1;
            self.msg_history[acp_id].msg_hist[0] = msg; //to CHANGE-> save two most recent messages
        } else {
            //create a new entry
            self.msg_history[acp_id] = {
                'acp_id': acp_id,
                'pinged': 1,
                'msg_hist': [msg]
            }
        }

        //get the txt box div
        let txt_hist = document.getElementById('text_collector');

        //reformat the message (for time or date)
        let recieved_time = self.jb_tools.make_time(msg.acp_ts) //alternatively use self.viz_tools.make_date(msg.acp_ts)

        //senf json object to the debug panel
        //*Important* only works with JSON.stringify(clean_msg_json)
        let clean_msg_json = {
            'acp_ts': msg.ts,
            'acp_id': msg.acp_id,
            'cooked': msg.payload_cooked
        }; //<br>'+INDENT+.substring(1, yourString.length-1)
        let cooked_txt = JSON.stringify(msg.payload_cooked); //optionally add (msg.payload_cooked,undefined, 10)10 is the indent
        let cooked_txt_clean = cooked_txt == undefined ? 'no msg' : cooked_txt.substring(1, cooked_txt.length - 1)

        let clean_msg_txt = recieved_time + '&nbsp&gt;&nbsp' + '<span id="green_span">' + msg.acp_id + "</span>" + '<pre id="json_msg">' + cooked_txt_clean + '</pre>';

        // txt_hist.innerHTML = JSON.stringify(clean_msg) + '<br><br>' + txt_hist.innerHTML;
        txt_hist.innerHTML = clean_msg_txt + '<br><br>' + txt_hist.innerHTML;

        var recent = new Date();
        document.getElementById('most_recent').innerHTML = recent.toString().slice(0, 24);

        // txt_hist.innerHTML += JSON.stringify(clean_msg)+'\n';
    }


    //-----------------------------------------------------------------------//
    //----------------------MOCK DEPLOYMENT FUNCTIONS BELOW------------------//
    //-----------------------------------------------------------------------//
    mock_data(self) {
        let acp_id = self.sub_list[Math.floor(Math.random() * self.sub_list.length)];
        let msg_data = {
            'acp_id': acp_id,
            'acp_ts': 999,
            'payload_cooked': {
                "temperature": 21.7,
                "humidity": 19,
                "light": 21,
                "motion": 0,
                "vdd": 3652,
                "occupancy": 0
            }
        }

        self.update_viz(self, acp_id, msg_data)
    }

    //callback to update sensors (for faked sensor data)
    update_callback(parent) {
        parent.mock_data(parent);
    }

    //async update for faked sensor data - updates all;
    //iterates through sensors and sets them to update on screen every *x* milliseconds
    update_sensors(parent, number) {

        for (let i = 0; i < number; i++) {
            window.setInterval(parent.update_callback, parent.jb_tools.random_int(6500, 6500 * 10), parent);
        }
    }

}

// ----------------------------------------------------------------------------------