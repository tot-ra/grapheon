/**
 * Grapheon is a graph drawing and analysis library in pure javascript using HTML5 canvas
 *
 * @author - Artjom Kurapov <artkurapov@gmail.com>
 * @license - CC BY 3.0, see http://creativecommons.org/licenses/by/3.0/
 *
 * @param id string - canvas DOM element id
 *
 *
 * todo move mouse controls to a separate independent part
 */

function Grapheon(user_options) {
    var me = this;

    var id = user_options.id;
    var canvas = document.getElementById(id);
    var queueNodes = new Array();

    this.ctx = canvas.getContext("2d");

    this.nodes = {};
    this.connections = new Object();
    this.connections_reverse = new Object();
    this.connection_count = 0;
    this.connections_index_prefferential = {};
    this.selected_nodes = 0;
    this.cycle_time = 0;
    this.step = 0;

    var default_options = {
        'canvas': {
            font: '11px Arial',
            background: '#FFF',
            width: 500,
            height: 500
        },

        //Drawing
        'draw_connections': 1,
        'labels': {'visible': 1},
        'nodes': {'visible': 1},
        'draw_with_min_mass': 1,
        'connection_min_width': 0.5,
        'connection_max_width': 1,
        'connection_color': '#000000',
        'selected_node_color': '#00AA00',
        'atom_min_radius': 3,
        'interval_redraw': 42, //the answer


        //Processing
        processing_algorithm: function(){
            alert('processing algorithm is not set');
        },
        'active': true, //set to false if you want to stop iterative calculation

        'energy_damping_percent': 0.95, //change to whatever value from 0 to 1 as a part of velocity that node will loose each step
        'energy_damping_step': 0,
        'repulsion_coeff': 1.5,
        'use_prefferential_attachment_connection_index': 0,


        'connection_min_weight': 0.01,
        'radius_ratio': 5,
        'max_movement_speed': 3,

        "explosion_radius": 100, //px

        'universe': {
            'limited': 1,
            'drag': {
                'x': 0,
                'y': 0,
                'enabled': false,

                'moved': false,
                'start_position': {
                    'x': 0,
                    'y': 0,
                    'zoom': 1
                }
            },
            'viewpoint': {
                'zoom': 1,
                'x': 0,
                'y': 0
            }
        },
        onNodeSelect: function () {
        }

    };

    this.options = array_merge(default_options, user_options);

    //set default processing algorithm
    //this.options.processing_algorithm =


    $('#' + id).mouseup(
        function (e) {

            if (!me.options.universe.drag.moved) {
                //Node selection on mouseup
                var virtualCursor = {
                    x: -me.options.universe.viewpoint.x + (e.pageX - $('#' + id).position().left) * me.options.universe.viewpoint.zoom,
                    y: -me.options.universe.viewpoint.y + (e.pageY - $('#' + id).position().top) * me.options.universe.viewpoint.zoom
                };

                min_len = 10000;
                min_node = 0;
                for (i in me.nodes) {
                    dx = me.nodes[i].x - virtualCursor.x;
                    dy = me.nodes[i].y - virtualCursor.y;
                    len = Math.sqrt(dx * dx + dy * dy);

                    if (len > 0 && min_len > len) {
                        min_len = len;
                        min_node = i;
                    }
                }

                if (min_node) {
                    me.selected_nodes = min_node;

                    me.options.onNodeSelect(me.nodes[min_node]);
                }
            }

            //Drag enabling
            me.options.universe.drag.enabled = false;
            me.options.universe.drag.moved = false;
            //options.universe.drag.start_position=options.universe.viewpoint;
        }).mousedown(
        function (e) {
            if (me.options.universe.drag.enabled == false) {
                me.options.universe.drag.enabled = true;
                me.options.universe.drag.x = e.pageX;
                me.options.universe.drag.y = e.pageY;

                me.options.universe.drag.start_position.x = me.options.universe.viewpoint.x;
                me.options.universe.drag.start_position.y = me.options.universe.viewpoint.y;
            }
            me.options.universe.drag.moved = false;
        }).mousemove(function (e) {
            //options.universe.viewpoint.drag = true;

            if (me.options.universe.drag.enabled == true) {
                diffX = Math.floor(e.pageX - me.options.universe.drag.x);
                diffY = Math.floor(e.pageY - me.options.universe.drag.y);

                me.options.universe.viewpoint.x = me.options.universe.drag.start_position.x + diffX * me.options.universe.viewpoint.zoom;
                me.options.universe.viewpoint.y = me.options.universe.drag.start_position.y + diffY * me.options.universe.viewpoint.zoom;
            }

            me.options.universe.drag.moved = true;
        });

    $('#' + id).bind('mousewheel', function (event, delta) {
        var offset = $('#' + id).offset();
        var cursor_relative_position = {x: event.pageX - offset.left, y: event.pageY - offset.top};

        var zoom_percent = 0.9;

        if (delta < 0) {
            sign = -1;
        }
        else {
            sign = 1;
        }

        me.options.universe.viewpoint.x = me.options.universe.viewpoint.x + sign * cursor_relative_position.x * (zoom_percent - 1);
        me.options.universe.viewpoint.y = me.options.universe.viewpoint.y + sign * cursor_relative_position.y * (zoom_percent - 1);

        me.options.universe.viewpoint.zoom = me.options.universe.viewpoint.zoom * Math.pow(zoom_percent, sign);

        /*
         var cursor_percent_position = {x:cursor_relative_position.x/window_width,y:cursor_relative_position.y/window_height};

         var zoom_percent;

         if(delta > 0){
         sign=-1;
         zoom_percent = 0.8;
         }
         else {
         zoom_percent = 1/0.8;
         sign=1;
         }

         diffX = cursor_percent_position.x * window_width * zoom_percent ;
         diffY = cursor_percent_position.y * window_height * zoom_percent ;

         options.universe.viewpoint.x = options.universe.viewpoint.x + sign * diffX;
         options.universe.viewpoint.y = options.universe.viewpoint.y + sign * diffY;

         options.universe.viewpoint.zoom = options.universe.viewpoint.zoom * zoom_percent;
         */


        if (me.options.universe.viewpoint.zoom < 0.1) {
            me.options.universe.viewpoint.zoom = 0.1;
        }

        return false;
    });

    this.getNextQueueNode = function () {
        return queueNodes.shift();
    };

    this.addNode = function (key, node_title, parentID) {
        //circular arrangement
        if (arguments[3] != null) {
            if (parentID) {
                sx = me.nodes[parentID].x;
                sy = me.nodes[parentID].y;
            }
            else {
                sx = 0;
                sy = 0;
            }

            startingX = sx + me.options.explosion_radius * Math.cos(2 * Math.PI * arguments[3]);
            startingY = sy + me.options.explosion_radius * Math.sin(2 * Math.PI * arguments[3]);
        }
        //random on page
        else if (parentID == null) {
            startingX = Math.random() * me.options.canvas.width;
            startingY = Math.random() * me.options.canvas.height;
        }
        //random rectangular arrangement
        else if (me.nodes[parentID] != null) {
            startingX = me.nodes[parentID].x + 2 * me.options.explosion_radius * (Math.random() - 0.5);
            startingY = me.nodes[parentID].y + 2 * me.options.explosion_radius * (Math.random() - 0.5);
        }
        else {
            console.error('failed positioning node ' + key);
        }


        if (typeof(me.nodes[key]) == 'undefined' && key) {
            me.nodes[key] = new Node(
                key,
                startingX,
                startingY,
                me.options.atom_min_radius,
                node_title);

            queueNodes.push(key);
            //getConnections(potentialNode.domainID);
        }

        return me;
    };

    this.addConnection = function (sourceNodeID, targetID, weight) {

        if(weight==null) weight=1;

        if (typeof(me.connections[sourceNodeID]) == 'undefined') {
            me.connections[sourceNodeID] = new Object();
        }//new Array();
        if (typeof(me.connections[targetID]) == 'undefined') {
            me.connections[targetID] = new Object();
        }//new Array();
        if (typeof(me.connections_reverse[sourceNodeID]) == 'undefined') {
            me.connections_reverse[sourceNodeID] = new Object();
        }//new Array();
        if (typeof(me.connections_reverse[targetID]) == 'undefined') {
            me.connections_reverse[targetID] = new Object();
        }//new Array();

        //undirected graph adds both connections
        me.connections[sourceNodeID][targetID] = weight;
        me.connections_reverse[targetID][sourceNodeID] = weight;

        me.connections[targetID][sourceNodeID] = weight;
        me.connections_reverse[sourceNodeID][targetID] = weight;

        me.nodes[sourceNodeID].mass = count(me.connections[sourceNodeID]);
        me.nodes[targetID].mass = count(me.connections_reverse[targetID]);

        if (this.use_prefferential_attachment_connection_index) {
            this.connections_index_prefferential[count(this.connections_index_prefferential) + 1] = sourceNodeID;
            this.connections_index_prefferential[count(this.connections_index_prefferential) + 1] = targetID;
        }

        this.connection_count++;

        return me;
    };

    /* Analysis methods */
    this.getKineticEnergy = function () {
        var en = 0;
        for (i in me.nodes) {
            en = en + me.nodes[i].mass * me.nodes[i].velocity.length() * me.nodes[i].velocity.length();
        }
        return parseInt(en / 2);
    };

    this.getClusteringLevel = function () {
        Csum = 0;

        for (i in me.nodes) {
            rank = getNodeRank(me.nodes[i].ID);
            if (rank > 1) {
                Csum = Csum + getNodeMutualFriendCount(me.nodes[i].ID) / (rank * (rank - 1));

            }
        }

        return Csum / count(me.nodes);
    };

    this.getDegreeArray = function () {
        var aDegrees = {};
        for (i in me.nodes) {
            if (typeof(aDegrees[me.nodes[i].mass]) == 'undefined') {
                aDegrees[me.nodes[i].mass] = 1;
            }
            else {
                aDegrees[me.nodes[i].mass]++;
            }
        }
        return aDegrees;
    };

    this.draw = function () {
        var start_time = (new Date).getTime();

        me.ctx.fillStyle = me.options.canvas.background;
        me.ctx.fillRect(0, 0, me.options.canvas.width, me.options.canvas.height);


        me.process();

        for (var i in me.nodes) {
            me.nodes[i].move(me.options.universe.limited);
        }

        if (me.options.draw_connections) {
            for (var j in me.nodes) {
                me.nodes[j].drawConnections(me);
            }
        }

        for (var k in me.nodes) {
            if (me.nodes[k].mass >= me.options.draw_with_min_mass) {
                me.nodes[k].draw(me);
            }
        }

        processing_time = (new Date).getTime() - start_time;

        if (processing_time != 0) {
            this.cycle_time = processing_time;
        }

        setTimeout(me.draw, me.options.interval_redraw);

        return me;
    };

    this.process = function () {
        me.step++;

        for (var i in me.nodes) {
            me.nodes[i] = me.options.processing_algorithm(me.nodes[i], me.connections, me.nodes, me.options, me.step);
        }

        for (var j in me.nodes) {
            me.nodes[j].move(me.options.universe.limited);
        }

        return me;
    };
/*
    this.startWorkers = function () {
        if (options.use_webworkers) {

            if (typeof(Worker) === "undefined") {
                alert('web workers not supported!');
                return false;
            }

            if (typeof(this.force_worker) === "undefined") {

                me.force_worker_step = 0;


                me.force_worker = new Worker('js/me.webworker.js');
                me.force_worker.onmessage = function (msg) {
                    console.log(this);

                    k = objKey(me.nodes, me.force_worker_step);
                    //console.log(me.nodes[k]);
                    me.nodes[k].velocity.x = msg.data.x;
                    me.nodes[k].velocity.y = msg.data.y;
                    if (me.force_worker_step < count(me.nodes) - 1) {
                        me.force_worker_step = me.force_worker_step + 1;
                    }
                    else {
                        me.force_worker_step = 0;
                    }

                    //console.log(me.force_worker_step);

                    me.force_worker.postMessage({
                        'connections': me.connections,
                        'nodes': me.nodes,
                        'i': me.force_worker_step,
                        'options': me.options
                    });
                };

                this.force_worker.postMessage({
                    'connections': me.connections,
                    'nodes': me.nodes,
                    'options': me.options,
                    'i': me.force_worker_step
                });
            }
        }
    };
*/
    this.getNodeRank = function (nodeID) {
        return count(me.connections[nodeID]);
    };

    this.getNodeMutualFriendCount = function (nodeID) {
        sum = 0;
        for (source in me.connections[nodeID]) {
            for (target in me.connections[source]) {
                //console.log(nodeID+':'+source+'/'+target);
                if (typeof(me.connections[nodeID][target]) != 'undefined') {
                    sum = sum + 1;
                }
            }

        }
        return sum;
    };

    return this;
}

function objKey(o, i) {
    k = 0;
    for (j in o) {
        if (i == k) {
            return j;
        }
        k++;
    }
}

function keyPos(o, i) {
    k = 0;
    for (j in o) {
        if (i == j) {
            return k;
        }
        k++;
    }
}

/**
 * Helper function. Counts number of properties in object
 * @param a
 */
function count(a) {
    if (typeof(a) == 'undefined') {
        return 0;
    }

    if (typeof(a) == 'array') {
        return a.length;
    }

    if (a.__count__ !== undefined) {
        return a.__count__;
    }
    return Object.keys(a).length;
}

/**
 * Overwrites obj1's values with obj2's and adds obj2's if non existent in obj1
 * @param obj1
 * @param obj2
 * @returns obj3 a new object based on obj1 and obj2
 */
function array_merge(obj1, obj2) {
    var obj3 = {};
    for (var attrname in obj1) {
        obj3[attrname] = obj1[attrname];
    }
    for (var attrname2 in obj2) {
        if (typeof(obj3[attrname2]) == 'object') {
            obj3[attrname2] = array_merge(obj3[attrname2], obj2[attrname2]);
        }
        else {
            obj3[attrname2] = obj2[attrname2];
        }
    }
    return obj3;
}