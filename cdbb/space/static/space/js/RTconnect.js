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
            "request_id": "abc"
        };

    }

    connect(callback, sensor_list) {
        let self = this;

        //if the sensor list is undefined, we want to open the socket for all messages
        if (sensor_list != undefined) {
            console.log('sensor list is defined', sensor_list)

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
            }

            //-------------------------------//
            //---------on regular msg--------//
            //-------------------------------//
            if (msg.msg_type != null && msg.msg_type == "rt_data") {
                let msg_data = JSON.parse(e.data).request_data[0]

                //report the data back to the master
                callback && callback('2', msg_data);
            }
        };
    }

    on_open(self) {
        console.log("Socket opened OK");
    }

    do_disconnect() {
        console.log("Disconnecting");
        socket.close();
    }

    on_error(event) {
        // The API doesn't expose error details here
        console.log("Error occurred - see browser console for details");
    }

    on_close(event) {
        console.log("Socket closed, clean = " + event.wasClean +
            ", code = " + event.code + " (" + closeCodeToString(event.code) + ")" +
            ", reason = " + event.reason);
    }
}