/**
 * @author Artjom Kurapov
 * @since 04.12.11 18:38
 */

function processLayout2(node, connections, nodes, options, step) {
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
                if (!weight) {
                    weight = options.connection_min_weight;
                }

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
                    if (AbsStep > options.max_movement_speed) {
                        AbsStep = options.max_movement_speed;
                    }
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
            if (AbsStep > options.max_movement_speed) {
                AbsStep = options.max_movement_speed;
            }

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
