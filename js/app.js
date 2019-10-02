import * as THREE from './build/three.module.js';
import { OBJLoader } from './jsm/loaders/OBJLoader.js';
import { GeometryUtils } from './jsm/utils/GeometryUtils.js';
var container;
var camera, scene, renderer;
var mouseX = 0, mouseY = 0;
var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;
var object;
var group, textMesh1, textGeo;
const materials = [
	new THREE.MeshPhongMaterial( { color: 0xffffff, flatShading: true } ), // front
	new THREE.MeshPhongMaterial( { color: 0xffffff } ) // side
];

init();
animate();

function init() {
	let container = document.getElementById('content');
	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
	camera.position.z = 250;

   
	// scene
	scene = new THREE.Scene();
	var ambientLight = new THREE.AmbientLight( 0xcccccc, 0.4 );
 	scene.add( ambientLight );
	var pointLight = new THREE.PointLight( 0xffffff, 0.8 );
	camera.add( pointLight );
	scene.add( camera );

    // fonts

    group = new THREE.Group();
	group.position.y = 100;
	scene.add( group );

    const fontObj = {
        text: "UX",
		height: 20,
		size: 70,
		hover: 30,
		curveSegments: 4,
		bevelThickness: 2,
		bevelSize: 1.5,
		bevelEnabled: true,
		font: undefined,
		fontName: "droid sans", // helvetiker, optimer, gentilis, droid sans, droid serif
		fntWeight: "bold" // normal bold
    };

    loadFont(fontObj);

    var plane = new THREE.Mesh(
		new THREE.PlaneBufferGeometry( 10000, 10000 ),
		new THREE.MeshBasicMaterial( { color: 0xffffff, opacity: 0.5, transparent: true } )
	);
	plane.position.y = 100;
	plane.rotation.x = - Math.PI / 2;
	scene.add( plane );

	// manager
	function loadModel() {
		object.traverse( function ( child ) {
			//if ( child.isMesh ) child.material.map = texture;
		} );
		object.position.y = - 95;
		scene.add( object );
	}
	var manager = new THREE.LoadingManager( loadModel );
	manager.onProgress = function ( item, loaded, total ) {
		console.log( item, loaded, total );
	};
	// texture
///	var textureLoader = new THREE.TextureLoader( manager );
///	var texture = textureLoader.load( 'textures/uv_grid_opengl.jpg' );
	// model
	function onProgress( xhr ) {
		if ( xhr.lengthComputable ) {
			var percentComplete = xhr.loaded / xhr.total * 100;
			console.log( 'model ' + Math.round( percentComplete, 2 ) + '% downloaded' );
		}
	}
	function onError() {}
	var loader = new OBJLoader( manager );
	loader.load( '../models/male02/male02.obj', function ( obj ) {
		object = obj;
	}, onProgress, onError );
	//
	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );
	document.addEventListener( 'mousemove', onDocumentMouseMove, false );
	//
	window.addEventListener( 'resize', onWindowResize, false );
}
function onWindowResize() {
	windowHalfX = window.innerWidth / 2;
	windowHalfY = window.innerHeight / 2;
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
}
function onDocumentMouseMove( event ) {
	mouseX = ( event.clientX - windowHalfX ) / 2;
	mouseY = ( event.clientY - windowHalfY ) / 2;
}
//
function animate() {
	requestAnimationFrame( animate );
	render();
}
function render() {
	camera.position.x += ( mouseX - camera.position.x ) * .05;
	camera.position.y += ( - mouseY - camera.position.y ) * .05;
	camera.lookAt( scene.position );
	renderer.render( scene, camera );
}


const refreshText = ( fontObj ) => {
	group.remove( textMesh1 );
	if ( ! fontObj.text ) return;
	createText(fontObj);
};

function loadFont( fontObj ) {
	const loader = new THREE.FontLoader();
	loader.load( 'fonts/droid/droid_sans_bold.typeface.json',  ( response ) => {
		fontObj.font = response;
		refreshText(fontObj);
	} );
};

function createText( fontObj ) {
	textGeo = new THREE.TextGeometry( fontObj.text, {
		font: fontObj.font,
		size: fontObj.size,
		height: fontObj.height,
		curveSegments: fontObj.curveSegments,
		bevelThickness: fontObj.bevelThickness,
		bevelSize: fontObj.bevelSize,
		bevelEnabled: fontObj.bevelEnabled
	} );
	textGeo.computeBoundingBox();
	textGeo.computeVertexNormals();
	// "fix" side normals by removing z-component of normals for side faces
	// (this doesn't work well for beveled geometry as then we lose nice curvature around z-axis)
	if ( ! fontObj.bevelEnabled ) {
		var triangleAreaHeuristics = 0.1 * ( fontObj.height * fontObj.size );
		for ( var i = 0; i < textGeo.faces.length; i ++ ) {
			var face = textGeo.faces[ i ];
			if ( face.materialIndex == 1 ) {
				for ( var j = 0; j < face.vertexNormals.length; j ++ ) {
					face.vertexNormals[ j ].z = 0;
					face.vertexNormals[ j ].normalize();
				}
				var va = textGeo.vertices[ face.a ];
				var vb = textGeo.vertices[ face.b ];
				var vc = textGeo.vertices[ face.c ];
				var s = GeometryUtils.triangleArea( va, vb, vc );
				if ( s > triangleAreaHeuristics ) {
					for ( var j = 0; j < face.vertexNormals.length; j ++ ) {
						face.vertexNormals[ j ].copy( face.normal );
					}
				}
			}
		}
	}
	var centerOffset = - 0.5 * ( textGeo.boundingBox.max.x - textGeo.boundingBox.min.x );
	textGeo = new THREE.BufferGeometry().fromGeometry( textGeo );
	textMesh1 = new THREE.Mesh( textGeo, materials );
	textMesh1.position.x = centerOffset;
	textMesh1.position.y = fontObj.hover;
	textMesh1.position.z = 0;
	textMesh1.rotation.x = 0;
	textMesh1.rotation.y = Math.PI * 2;
	group.add( textMesh1 );
};

