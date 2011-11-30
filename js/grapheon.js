/**
 * Grapheon is a graph drawing and analysis library in pure javascript using HTML5 canvas
 *
 * @author - Artjom Kurapov <artkurapov@gmail.com>
 * @license - CC BY 3.0, see http://creativecommons.org/licenses/by/3.0/
 *
 * @param id string - canvas DOM element id
 */
function Grapheon(id) {
    var me = this;
    var canvas = document.getElementById(id);
    var queueNodes = new Array();

    this.window_width = $("#" + id).width();
    this.window_height = $("#" + id).height();
    this.ctx = canvas.getContext("2d");

    this.nodes = {};
    this.connections = new Object();
    this.connections_reverse = new Object();
    this.connection_count = 0;
    this.connections_index_prefferential = {};

    this.selected_nodes = 0;

    this.cycle_time = 0;
    this.step = 0;

    this.options = {
        onNodeSelect:function () {},

        'canvas':{
            'font':'11px Arial'
        },

        'active':1, //set to 0 if you want to stop iterative calculation
        'use_webworkers':0, //set to 1 if you want threaded calculation
        'energy_damping_percent':0.95, //change to whatever value from 0 to 1 as a part of velocity that node will loose each step
        'energy_damping_step':0,
        'repulsion_coeff':1.5,
        'use_prefferential_attachment_connection_index':0,
        'atom_min_radius':3,

        //Drawing
        'draw_connections':1,
        'labels':{'visible':0},
        'nodes':{'visible':1},

        'draw_with_min_mass':1,
        'connection_min_width':0.1,
        'connection_max_width':1,
        'connection_min_weight':0.01,
        'connection_color':'#000000',
        'selected_node_color':'#AA0000',
        'radius_ratio':15,
        'max_movement_speed':3,
        'interval_redraw':41, //ms
        "explosion_radius":100, //px

        'universe':{
            'limited':1,
            'drag':{
                'x':0,
                'y':0,
                'enabled':false,

                'moved':false,
                'start_position':{
                    'x':0,
                    'y':0,
                    'zoom':1
                }
            },
            'viewpoint':{
                'zoom':1,
                'x':0,
                'y':0
            }
        }
    };

    //set default processing algorithm
    this.options.processing_algorithm = function (node, connections, nodes, options) {
        ForceSum = Vector(0, 0);

        var iOptimalDistance = 10;
        var fRepulsionCoefficient = options.repulsion_coeff;


        function recursiveAttractiveForceFlow(ForceSum, realNode, node, deepness, level_multiplier, traversed_nodes) {
            //Simple attraction force for outgoing connections
            if (connections[node.ID]) {
                for (i in connections[node.ID]) {
                    dstNode = nodes[i];
                    if (dstNode != null && realNode.ID != dstNode.ID /*&& dstNode.mass > options.forces.min_weight_for_calculation*/) {
                        weight = connections[node.ID][i];
                        if (!weight)
                            weight = options.connection_min_weight;

                        /**
                         Move nodes based on its connections
                         */

                            //AttractionVector = Vector((dstNode.x-this.x) , (dstNode.y-this.y));
                        AttractionVector = Vector((dstNode.x - realNode.x), (dstNode.y - realNode.y));

                        AttractionVector.normalize();
                        AbsStep = AttractionVector.square() / iOptimalDistance /* - iOptimalDistance*/;
                        if (AbsStep > options.max_movement_speed) {
                            AbsStep = options.max_movement_speed;
                        }
                        AttractionVector.multiply(AbsStep);
                        AttractionVector.multiply(level_multiplier);

                        ForceSum.add(AttractionVector);
                        deepness--;
                        if (deepness > 0 && typeof(traversed_nodes[dstNode3.ID]) == 'undefined') {
                            traversed_nodes[dstNode.ID] = 1;
                            recursiveAttractiveForceFlow(ForceSum, realNode, dstNode, deepness, level_multiplier, traversed_nodes);
                        }
                    }
                }
            }
        }


        function recursiveRepulsiveForceFlow(ForceSum, realNode, node, deepness, level_multiplier, traversed_nodes) {
            if (connections[node.ID]) {
                for (z in connections[node.ID]) {
                    dstNode3 = nodes[z];

                    if (dstNode3 != null && realNode.ID != dstNode3.ID/*&& Math.abs(dstNode3.x-node.x)<2*(dstNode3.r+node.r) && Math.abs(dstNode3.y-node.y)<2*(dstNode3.r+node.r)*/) {

                        RepulsionVector = Vector(
                            -(dstNode3.x - realNode.x),
                            -(dstNode3.y - realNode.y)
                        );

                        AbsStep = fRepulsionCoefficient * iOptimalDistance * iOptimalDistance / RepulsionVector.length();
                        if (AbsStep > options.max_movement_speed) AbsStep = options.max_movement_speed;

                        RepulsionVector.normalize();
                        RepulsionVector.multiply(level_multiplier);

                        RepulsionVector.multiply(AbsStep); /// (connections[i].__count__)

                        ForceSum.add(RepulsionVector);

                        deepness--;
                        if (deepness > 0 && typeof(traversed_nodes[dstNode3.ID]) == 'undefined') {
                            traversed_nodes[dstNode3.ID] = 1;
                            recursiveRepulsiveForceFlow(ForceSum, realNode, dstNode3, deepness, level_multiplier * level_multiplier, traversed_nodes);
                        }
                    }
                }
            }
        }

        recursiveAttractiveForceFlow(ForceSum, node, node, 1, 0.3, {});
        recursiveRepulsiveForceFlow(ForceSum, node, node, 2, 0.3, {});

        //ForceSum.normalize();
        node.acceleration = ForceSum;
        /*
         node.acceleration.x = node.acceleration.x * options.energy_damping_percent;
         node.acceleration.y = node.acceleration.y * options.energy_damping_percent;
         */
        energyLoss = options.energy_damping_percent;

        if (node.acceleration.length() < 0.1) {
            node.energyGainStep++;
            if (node.energyGainStep > 5) {
                energyLoss = (1 / Math.log(me.step) - 0.1) / energyLoss;
                if (energyLoss < 0) energyLoss = 0;
            }
        }
        else {
            node.energyGainStep = 0;
        }

        //node.mass
        node.velocity.x = energyLoss * (node.velocity.x + node.acceleration.x);
        node.velocity.y = energyLoss * (node.velocity.y + node.acceleration.y);


        //if(node.velocity.length()<0.1) node.velocity.multiply(0);
    //	node.velocity = SumAttractionVector;

        return node;
    };


    $('#' + id).mouseup(
        function (e) {

            if (!me.options.universe.drag.moved) {
                //Node selection on mouseup
                var virtualCursor = {
                    x:-me.options.universe.viewpoint.x + (e.pageX - $('#' + id).position().left) * me.options.universe.viewpoint.zoom,
                    y:-me.options.universe.viewpoint.y + (e.pageY - $('#' + id).position().top) * me.options.universe.viewpoint.zoom
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
            if (options.universe.drag.enabled == false) {
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
        var cursor_relative_position = {x:event.pageX - offset.left, y:event.pageY - offset.top};

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


        if (me.options.universe.viewpoint.zoom < 0.1){
            me.options.universe.viewpoint.zoom = 0.1;
        }

        return false;
    });

    this.getNextQueueNode = function () {
        return queueNodes.shift();
    };

    this.addNode = function (key, parentID, domain_name) {

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
        else if (parentID == 0) {
            startingX = Math.random() * me.window_width;
            startingY = Math.random() * me.window_height;
        }
        //random rectangular arrangement
        else {
            startingX = me.nodes[parentID].x + 2 * me.options.explosion_radius * (Math.random() - 0.5);
            startingY = me.nodes[parentID].y + 2 * me.options.explosion_radius * (Math.random() - 0.5);
        }


        if (typeof(me.nodes[key]) == 'undefined' && key) {
            me.nodes[key] = new Node(
                key,
                startingX,
                startingY,
                me.options.atom_min_radius,
                domain_name);

            queueNodes.push(key);
            //getConnections(potentialNode.domainID);
        }
    };

    this.addConnection = function (sourceNodeID, targetID, weight) {
        if (typeof(me.connections[sourceNodeID]) == 'undefined') me.connections[sourceNodeID] = new Object();//new Array();
        if (typeof(me.connections[targetID]) == 'undefined') me.connections[targetID] = new Object();//new Array();
        if (typeof(me.connections_reverse[sourceNodeID]) == 'undefined') me.connections_reverse[sourceNodeID] = new Object();//new Array();
        if (typeof(me.connections_reverse[targetID]) == 'undefined') me.connections_reverse[targetID] = new Object();//new Array();

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
            if (typeof(aDegrees[me.nodes[i].mass]) == 'undefined') aDegrees[me.nodes[i].mass] = 1;
            else aDegrees[me.nodes[i].mass]++;
        }
        return aDegrees;
    };

    this.draw = function () {
        var start_time = (new Date).getTime();

        me.ctx.fillStyle = "#fff";
        me.ctx.fillRect(0, 0, this.window_width, this.window_height);


        if (!me.options.use_webworkers) {
            this.process();
        }
        
        else if (typeof(this.force_worker) === "undefined") {
            this.startWorkers();
        }


        for (var i in me.nodes) {
            me.nodes[i].move();
        }

        if (me.options.draw_connections) {
            for (var j in this.nodes) {
                this.nodes[j].drawConnections();
            }
        }

        for (var k in me.nodes) {
            if (me.nodes[k].mass >= this.options.draw_with_min_mass)
                me.nodes[k].draw();
        }

        processing_time = (new Date).getTime() - start_time;

        if (processing_time != 0)
            this.cycle_time = processing_time;


        setTimeout(this.draw, me.options.interval_redraw);
    };

    this.process = function () {
        me.step++;
        var processName = 'processLayout' + me.options.processing_algorithm;

        for (var i in me.nodes) {
            me.nodes[i] = me.options.processing_algorithm(me.nodes[i],me.connections,me.nodes,me.options);
        }

        for (var j in me.nodes) {
            me.nodes[j].move();
        }

    };

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
                    if (me.force_worker_step < count(me.nodes) - 1) me.force_worker_step = me.force_worker_step + 1;
                    else me.force_worker_step = 0;

                    //console.log(me.force_worker_step);

                    me.force_worker.postMessage({
                        'connections':me.connections,
                        'nodes':me.nodes,
                        'i':me.force_worker_step,
                        'options':me.options
                    });
                };

                this.force_worker.postMessage({
                    'connections':me.connections,
                    'nodes':me.nodes,
                    'options':me.options,
                    'i':me.force_worker_step
                });
            }
        }
    };

    this.getNodeRank = function (nodeID) {
        return count(connections[nodeID]);
    };

    this.getNodeMutualFriendCount = function (nodeID) {
        sum = 0;
        for (source in connections[nodeID]) {
            for (target in connections[source]) {
                //console.log(nodeID+':'+source+'/'+target);
                if (typeof(connections[nodeID][target]) != 'undefined') {
                    sum = sum + 1;
                }
            }

        }
        return sum;
    };

    return this;
}

function processLayout2(node, connections, nodes, options) {
    ForceSum = Vector(0, 0);

    var iOptimalDistance = 10;
    var fRepulsionCoefficient = options.repulsion_coeff;
    //console.log(SumAttractionVector.x);
    //Simple attraction force for outgoing connections
    if (connections[node.ID]) {
        for (i in connections[node.ID]) {
            dstNode = nodes[i];
            if (dstNode != null /*&& dstNode.mass > options.forces.min_weight_for_calculation*/) {
                weight = connections[node.ID][i];
                if (!weight)
                    weight = options.connection_min_weight;

                /**
                 Move nodes based on its connections
                 */

                    //AttractionVector = Vector((dstNode.x-this.x) , (dstNode.y-this.y));
                AttractionVector = Vector((dstNode.x - node.x), (dstNode.y - node.y));

                //50 * Math.min(dstNode.mass,this.mass);
                //if(AttractionVector.length()>iOptimalDistance-5)
                {

                    //transitivity_rate = Math.pow(Math.min(connections[this.ID].__count__ , connections[i].__count__),0.5);

                    //me.options.atom_repulsion_distance / transitivity_rate
                    AttractionVector.normalize();
                    AbsStep = AttractionVector.square() / iOptimalDistance /* - iOptimalDistance*/;
                    if (AbsStep > options.max_movement_speed) AbsStep = options.max_movement_speed;
                    AttractionVector.multiply(AbsStep);

                    ForceSum.add(AttractionVector);
                }


                /*
                 RepulsionVector = Vector(-(dstNode.x-this.x) , -(dstNode.y-this.y));

                 if(RepulsionVector.length()<iOptimalDistance+5)
                 {
                 RepulsionVector.normalize();
                 RepulsionVector.forceMultiplier(
                 me.options.forces.repulsion.law,iOptimalDistance
                 );

                 ForceSum.add(RepulsionVector);
                 }
                 */

                //ForceSum.add(RepulsionVector);


                //cycle all connected nodes and repulse
                //angular repulsion
                /*
                 if(options.forces.angular_repulsion.enabled && connections[i]){
                 //var target_connection_count = count(connections[i]);
                 for(j in connections[i]){
                 dstNode2=nodes[j];
                 if(i!=j && dstNode2!=null){

                 RepulsionVector = Vector(
                 (dstNode2.x-node.x),
                 (dstNode2.y-node.y)
                 );

                 //RepulsionVector.toForce(me.options.atom_repulsion_distance);
                 /// (transitivity_rate * connections[i].__count__)

                 /// connections[i].__count__

                 //k = - 1;

                 //console.log(k);
                 AbsStep = fRepulsionCoefficient * iOptimalDistance * iOptimalDistance / RepulsionVector.length();

                 if(AbsStep>options.max_movement_speed) AbsStep=options.max_movement_speed;

                 RepulsionVector.normalize();
                 RepulsionVector.multiply(-AbsStep ); /// (connections[i].__count__)

                 ForceSum.add(RepulsionVector);
                 }
                 }
                 }
                 */
            }

        }
    }

    for (z in nodes) {
        dstNode3 = nodes[z];

        if (dstNode3 != null && node.ID != dstNode3.ID/*&& Math.abs(dstNode3.x-node.x)<2*(dstNode3.r+node.r) && Math.abs(dstNode3.y-node.y)<2*(dstNode3.r+node.r)*/) {

            RepulsionVector = Vector(
                -(dstNode3.x - node.x),
                -(dstNode3.y - node.y)
            );

            AbsStep = fRepulsionCoefficient * iOptimalDistance * iOptimalDistance / RepulsionVector.length();
            if (AbsStep > options.max_movement_speed) AbsStep = options.max_movement_speed;

            RepulsionVector.normalize();
            //RepulsionVector.multiply( 3);

            RepulsionVector.multiply(AbsStep); /// (connections[i].__count__)

            ForceSum.add(RepulsionVector);

        }
    }

    //ForceSum.normalize();
    node.acceleration = ForceSum;
    /*
     node.acceleration.x = node.acceleration.x * options.energy_damping_percent;
     node.acceleration.y = node.acceleration.y * options.energy_damping_percent;
     */
    energyLoss = options.energy_damping_percent;

    if (node.acceleration < 1) {
        node.energyGainStep++;
        if (node.energyGainStep > 5) {
            energyLoss = 1 / energyLoss;
        }
    }
    else {
        node.energyGainStep = 0;
    }

    //node.mass
    node.velocity.x = energyLoss * (node.velocity.x + node.acceleration.x);
    node.velocity.y = energyLoss * (node.velocity.y + node.acceleration.y);


    //if(node.velocity.length()<0.1) node.velocity.multiply(0);
//	node.velocity = SumAttractionVector;

    return node;
}

function objKey(o, i) {
    k = 0;
    for (j in o) {
        if (i == k) return j;
        k++;
    }
}

function keyPos(o, i) {
    k = 0;
    for (j in o) {
        if (i == j) return k;
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
