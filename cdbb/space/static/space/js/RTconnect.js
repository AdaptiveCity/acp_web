"use strict"

class RTconnect {
    constructor(master) {

        //master element e.g. SSD, Rain, Splash that RTmon is going to report to upon receiving messages
        this.master = master;

        //initiate socket
        this.socket;

        this.connect_url = 'https://tfc-app9.cl.cam.ac.uk/rtmonitor/A/mqtt_acp' //'https://tfc-app6.cl.cam.ac.uk/rtmonitor/A/mqtt_acp';

        this.connect_msg = {
            "msg_type": "rt_connect",
            "client_data": {
                "rt_client_name": "Socket Client",
                "rt_client_id": "socket_client",
                "rt_client_url": "https://tfc-app4.cl.cam.ac.uk/backdoor/socket-client/index.html",
                "rt_token": "888"
            }
        };

        this.connect_filter = {
            "msg_type": "rt_subscribe",
            "request_id": "abc",
            "options": [ "previous_msg", "latest_msg" ]
        };

        this.sub_list;
        this.parent_callback;

        this.last_msg_received; //will save the ts from the last msg received
        this.periodic_timer;

        this.periodic_check = 1000 * 60 * 15; //every fifteen mins
        this.last_msg_timeout = 1000 * 60 * 5; //5mins after last message

        // Value	State	Description
        // 0	CONNECTING	Socket has been created. The connection is not yet open.
        // 1	OPEN	The connection is open and ready to communicate.
        // 2	CLOSING	The connection is in the process of closing.
        // 3	CLOSED	The connection is closed or couldn't be opened.

        this.state_dict = {
            0: 'CONNECTING',
            1: 'OPEN',
            2: 'CLOSING',
            3: 'CLOSED'
        };
    }

    connect(callback, sensor_list) {
        let self = this;

        //save the parent callback, since we need it when reconnecting
        self.parent_callback = callback;

        //if the sensor list is undefined, we want to open the socket for all messages
        if (sensor_list != undefined) {
            console.log('sensor list is defined', sensor_list.length)

            self.sub_list = sensor_list

            //else filter it based on the selected sensors from the list
            self.connect_filter['filters'] = [{
                "key": "acp_id",
                "test": "in",
                "values": self.sub_list
            }];
        };

        self.socket = new SockJS(self.connect_url);

        //-------------------------------//
        //------------on_open------------//
        //-------------------------------//
        self.socket.onopen = function () {
            console.log('open');
            self.socket.send(JSON.stringify(self.connect_msg));
        };

        //-------------------------------//
        //------------on_close------------//
        //-------------------------------//
        self.socket.onclose = function () {
            self.on_close(self)
        };


        //-------------------------------//
        //------on_message received------//
        //-------------------------------//
        self.socket.onmessage = function (e) {
            console.log('new message');
            let msg = JSON.parse(e.data);
            if (msg.msg_type != null && msg.msg_type == "rt_nok") {
                console.log('Error', e.data);
                //-------------------------------//
                //----------do reconnect---------//
                //-------------------------------//
            }

            //-------------------------------//
            //-----on successful connect-----//
            //-------------------------------//
            if (msg.msg_type != null && msg.msg_type == "rt_connect_ok") {
                console.log("Connected", self.connect_filter)
                self.socket.send(JSON.stringify(self.connect_filter))
                callback && callback('1');

                //after the connection was successful, we want to check that 
                //that the connection is stable every 15(?) minutes
                self.check_periodic(self);
            }

            //-------------------------------//
            //---------on regular msg--------//
            //-------------------------------//
            if (msg.msg_type != null && msg.msg_type == "rt_data") {
                let msg_data = JSON.parse(e.data).request_data[0]

                //report the data back to the master
                callback && callback('2', msg_data);

                //clear the previous timer since last message
                clearTimeout(self.last_msg_received);

                //launch a new timer to check if new messages have arrived in the window of 5 mins
                self.check_since_last(self)
            }
        };
    }

    on_open(self) {
        console.log("Socket opened OK");
    }

    do_disconnect(self) {
        console.log("Disconnecting");
        self.socket.close();
        //clear timers
        clearTimeout(self.last_msg_received);
        clearTimeout(self.periodic_timer);

    }

    on_error(event) {
        // The API doesn't expose error details here
        console.log("Error occurred - see browser console for details");
    }

    on_close(self) {
        console.log('CLOSING')
        //get the state confirming closing
        let socket_state = self.socket.readyState;
        //print out the state
        console.log('connection state is', self.state_dict[socket_state], '(' + socket_state + ')');
    }

    check_periodic(self) {

        //check state of the connection 
        let socket_state = self.socket.readyState;

        console.log('connection state is', self.state_dict[socket_state], '(' + socket_state + ')');

        //check if the state is disconnecting or disconnected
        if (socket_state == 2 || socket_state == 3) {

            //discconnect for a good measure
            self.do_disconnect(self);

            //attempt reconnect
            self.connect(self.parent_callback, self.sub_list)
        }

        //else we continue as usual 

        //set a periodic timer to check the state every 15mins
        self.periodic_timer = setTimeout(function () {

            console.log('checking connection status', new Date())
            self.check_periodic(self);

        }, self.periodic_check);
    }

    check_since_last(self) {

        //define a timer that starts ticking after a new message has been received
        self.last_msg_received = setTimeout(function () {

            console.log('5 mins passed since last msd, checking connection status', new Date())
            //check state of the connection 
            let socket_state = self.socket.readyState;

            console.log('connection state is', self.state_dict[socket_state], '(' + socket_state + ')');

            //check if the state is disconnecting or disconnected
            if (socket_state == 2 || socket_state == 3) {

                //discconnect for a good measure
                self.do_disconnect(self);

                //attempt reconnect
                self.connect(self.parent_callback, self.sub_list)
            }


        }, self.last_msg_timeout);
    }
}