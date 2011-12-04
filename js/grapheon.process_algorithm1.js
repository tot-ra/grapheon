/**
 * @author Artjom Kurapov
 * @since 04.12.11 18:32
 */

function processingAlgorithm1 (node, connections, nodes, options, step) {
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
                        if (!weight) {
                            weight = options.connection_min_weight;
                        }

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
                        if (AbsStep > options.max_movement_speed) {
                            AbsStep = options.max_movement_speed;
                        }

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
                energyLoss = (1 / Math.log(step) - 0.1) / energyLoss;
                if (energyLoss < 0) {
                    energyLoss = 0;
                }
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