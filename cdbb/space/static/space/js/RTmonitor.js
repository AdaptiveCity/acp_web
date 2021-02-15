"use strict"

class RTmonitor {
    constructor(master) {

        //master element e.g. SSD, Rain, Splash that RTmon is going to report to upon receiving messages
        this.master = master;

        //initiate socket
        this.socket;

        // Instantiate a jb2328 utility class e.g. for getBoundingBox()
        this.viz_tools = new VizTools();
        this.jb_tools = new VizTools2();

        this.CONNECT_URL = 'https://tfc-app9.cl.cam.ac.uk/rtmonitor/A/mqtt_acp' //'https://tfc-app6.cl.cam.ac.uk/rtmonitor/A/mqtt_acp';

        this.CONNECT_MSG = {
            "msg_type": "rt_connect",
            "client_data": {
                "rt_client_name": "Socket Client",
                "rt_client_id": "socket_client",
                "rt_client_url": "https://tfc-app4.cl.cam.ac.uk/backdoor/socket-client/index.html",
                "rt_token": "888"
            }
        };

        this.CONNECT_FILTER_ALL = {
            "msg_type": "rt_subscribe",
            "request_id": "abc",
        };

        //this.SENSOR_LIST = ["elsys-co2-041ba8", "elsys-co2-041ba9", "elsys-co2-041baa", "elsys-co2-0460ec", "elsys-co2-0461e4", "elsys-co2-0461e6", "elsys-co2-0461e7", "elsys-ems-048f2b", "elsys-eye-044501", "ijl20-co2-0366b0"];

        this.CONNECT_FILTER = {
            "msg_type": "rt_subscribe",
            "request_id": "abc"
        };

    }

    connect(sensor_list) {
        let self = this;

        if (sensor_list == undefined) {
            // this.sub_list = SENSOR_LIST
            //this.CONNECT_FILTER['filters']=[];
        } else {
            self.sub_list = sensor_list
            self.CONNECT_FILTER['filters'] = {
                "key": "acp_id",
                "test": "in",
                "values": self.sub_list
            };
        }

        self.socket = new SockJS(self.CONNECT_URL);

        //-------------------------------//
        //------------on_open------------//
        //-------------------------------//
        self.socket.onopen = function () {
            console.log('open');
            self.socket.send(JSON.stringify(self.CONNECT_MSG));
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
                console.log("Connected")
                document.getElementById('rt_monitor').innerHTML = 'Connected'
                self.socket.send(JSON.stringify(self.CONNECT_FILTER))
            }

            //-------------------------------//
            //---------on regular msg--------//
            //-------------------------------//
            if (msg.msg_type != null && msg.msg_type == "rt_data") {
                let msg_data = JSON.parse(e.data).request_data[0]
                console.log(msg_data);

                //report the data back to the master
                self.master.on_message(self.master, msg_data);

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