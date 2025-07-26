'use strict';

//const vConsole = new VConsole();
//const remoteConsole = new RemoteConsole("http://[remote server]/logio-post");
//window.datgui = new dat.GUI();

const base_url = "";

var vue_options = {
    el: "#top",
    mixins: [mixins_bootstrap],
    store: vue_store,
    router: vue_router,
    data: {
        message_list: [],
        thread_message_list: [],
        input_message: "",
        input_apikey: "",
        mode: "current",
        thread: "",
        tool_list: [],
    },
    computed: {
    },
    methods: {
        apikey_config_open: function(){
            this.input_apikey = this.apikey;
            this.dialog_open("#apikey_config_dialog");
        },
        apikey_config_save: function(){
            localStorage.setItem("chatagent_apikey", this.input_apikey);
            this.apikey = this.input_apikey;
            this.dialog_close("#apikey_config_dialog");
        },
        show_tools: async function(){
            var input = {
                url: base_url + "/gemini-list-tools",
                api_key: this.apikey
            };
            var response = await do_http(input);
            console.log(response);

            this.tool_list = response.list.sort((a, b) =>{
                if( a.name < b.name ) return -1;
                if( a.name > b.name ) return 1;
                return 0;
            });

            this.dialog_open("#show_tools_dialog");
        },

        start_new_thread: async function(){
            var input = {
                url: base_url + "/gemini-new-thread",
                api_key: this.apikey
            };
            var response = await do_http(input);
            console.log(response);

            this.mode = "current";
            this.thread = "";
            this.message_list = [];
            this.thread_message_list = [];
        },
        select_thread: async function(){
            if( this.thread == "" ){
                this.mode = "current";
            }else{
                try{
                    var input = {
                        url: base_url + "/gemini-get-history",
                        api_key: this.apikey
                    };
                    var response = await do_http(input);
                    console.log(response);

                    var list = [];
                    var funcCall = {};
                    for( var i = 0 ; i < response.history.length ; i++ ){
                        var message = response.history[i];
                        for( var j = 0 ; j < message.parts.length ; j++ ){
                            var part = message.parts[j];
                            if( part.text ){
                                list.push({
                                    type: "text",
                                    text: part.text,
                                    role: message.role
                                });
                            }else if( part.functionCall ){
                                funcCall = {
                                    type: "func_call",
                                    call: {
                                        name: part.functionCall.name,
                                        args: JSON.stringify(part.functionCall.args)
                                    }
                                };
                            }else if( part.functionResponse){
                                funcCall.response = {
                                    name: part.functionResponse.name,
                                    content: JSON.stringify(part.functionResponse.response.content)
                                };
                                list.push(funcCall);
                                funcCall = {};
                            }
                        }
                    }
                    console.log(list);

                    this.thread_message_list = list;

                    this.mode = "thread";
                }catch(error){
                    console.error(error);
                    alert(error);
                }
            }
        },
        send_message: async function(){
            try{
                this.mode = "current";
                this.thread = "";
                var message = {
                    datetime: new Date().getTime(),
                    input: this.input_message,
                    inProgress: true,
                };
                this.message_list.unshift(message);

                var input = {
                    url: base_url + "/gemini-generate",
                    body: {
                        message: message.input
                    },
                    api_key: this.apikey
                };
                var response = await do_http(input);
                console.log(response);

                message.output = response.message;
                this.input_message = "";
            }catch(error){
                console.error(error);
                alert(error);
            }finally{
                message.inProgress = false;
            }
        },
    },
    created: function(){
    },
    mounted: async function(){
        proc_load();

        this.apikey = localStorage.getItem("chatagent_apikey");
    }
};
vue_add_data(vue_options, { progress_title: '' }); // for progress-dialog
vue_add_global_components(components_bootstrap);
vue_add_global_components(components_utils);

/* add additional components */
  
window.vue = new Vue( vue_options );
