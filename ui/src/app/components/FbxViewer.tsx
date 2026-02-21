'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface FbxViewerProps {
    url: string;
}

export default function FbxViewer({ url }: FbxViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // --- Scene Setup ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf0f0f0);

        const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
        camera.position.set(2, 2, 5);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        containerRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        // --- Lighting ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); // Increase intensity
        scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
        hemiLight.position.set(0, 20, 0);
        scene.add(hemiLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(5, 10, 7.5);
        scene.add(directionalLight);

        // --- Load FBX ---
        const manager = new THREE.LoadingManager();
        manager.addHandler(/\.tga$/i, new TGALoader());

        const loader = new FBXLoader(manager);
        loader.load(url, (object) => {
            object.traverse((child: any) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (!child.material) {
                        child.material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
                        return;
                    }

                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach((m: any) => {
                        if (m.map?.image) {
                            m.map.colorSpace = THREE.SRGBColorSpace;
                            m.map.needsUpdate = true;
                        }

                        // FBX materials tend to look glossier than GLB PBR.
                        // Clamp to a less specular look for preview parity.
                        if ('metalness' in m && typeof m.metalness === 'number') {
                            m.metalness = Math.min(m.metalness, 0.1);
                        }
                        if ('roughness' in m && typeof m.roughness === 'number') {
                            m.roughness = Math.max(m.roughness, 0.75);
                        }
                        if ('shininess' in m && typeof m.shininess === 'number') {
                            m.shininess = Math.min(m.shininess, 20);
                        }
                        if ('specular' in m && m.specular) {
                            m.specular.setRGB(0.15, 0.15, 0.15);
                        }
                        m.needsUpdate = true;
                    });
                }
            });

            // Auto-center and scale
            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 3 / maxDim;
            object.scale.set(scale, scale, scale);

            // Re-center after scale
            object.position.sub(center.multiplyScalar(scale));

            scene.add(object);
        }, undefined, (error) => {
            console.error('An error happened while loading the FBX:', error);
        });

        // --- Animation Loop ---
        const animate = () => {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // --- Cleanup ---
        return () => {
            if (containerRef.current) {
                containerRef.current.removeChild(renderer.domElement);
            }
            geometryDispose(scene);
        };
    }, [url]);

    const geometryDispose = (node: THREE.Object3D | THREE.Scene) => {
        node.traverse((child: any) => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((m: any) => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
    };

    return <div ref={containerRef} style={{ width: '100%', height: '300px', borderRadius: '8px', overflow: 'hidden' }} />;
}
