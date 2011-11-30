$(document).ready(function(){
	stoppable_drawing = 0;
	graph.use_prefferential_attachment_connection_index = 1;
	
	graph.addNode(1,0,1);
	
	setInterval(function(){
		id = count(graph.nodes)+1;
	
		if(graph.connection_count==0){
			parentID = 1;
		}
		else{
			iVerticeBase = Math.ceil(count(graph.connections_index_prefferential) * Math.random());
			parentID = graph.connections_index_prefferential[iVerticeBase];
		}
		
		graph.addNode(id, parentID, id);
		
		if(parentID>0){
			graph.addConnection(id, parentID, 1);
		//	graph.addConnection(parentID,id, 1);
		}
		
	},500);
	
	setInterval(function(){
		iClustering = graph.getClusteringLevel().toFixed(2);
		if(iClustering< 1 * $('#clustering_level').html()) $('#clustering_level').css('color','red');
		if(iClustering > 1 * $('#clustering_level').html()) $('#clustering_level').css('color','green');
		$('#clustering_level').html(iClustering);
	},7000);
});
