import * as THREE from "three";
import { MindARThree } from "mindar-image-three";

const baseUrl = "https://pub-dd4446412aff4b8ca42353ad71f1cf3c.r2.dev";

const targets = [
  { index: 0, videoSrc: `${baseUrl}/demo-video.mp4` }
];

const loadingEl = document.createElement("div");
loadingEl.style.cssText = "position:fixed;inset:0;background:black;color:white;display:flex;align-items:center;justify-content:center;font-family:sans-serif;font-size:1.2rem;z-index:20;";
loadingEl.textContent = "Loading animations... (0/" + targets.length + ")";

let loaded = 0;

const preloadVideo = (src) => {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.src = src;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.load();

    video.play().then(() => {
      console.log(`[PLAY OK] ${src}`);
      console.log(`[VIDEO STATE] readyState: ${video.readyState}, videoWidth: ${video.videoWidth}, videoHeight: ${video.videoHeight}`);
      video.pause();
    }).catch(err => {
      console.error(`[PLAY FAILED] ${src}`, err);
    });

    const done = () => {
      loaded++;
      loadingEl.textContent = `Loading animations... (${loaded}/${targets.length})`;
      console.log(`[LOADED] ${src} | readyState: ${video.readyState} | w: ${video.videoWidth} h: ${video.videoHeight}`);
      resolve(video);
    };
    video.addEventListener("canplaythrough", done, { once: true });
    setTimeout(() => {
      console.warn(`[TIMEOUT] ${src} | readyState: ${video.readyState}`);
      done();
    }, 20000);
  });
};

const videoTextures = [];

const start = async () => {
  document.body.appendChild(loadingEl);

  const preloadedVideos = await Promise.all(
    targets.map(t => preloadVideo(t.videoSrc))
  );

  loadingEl.textContent = "Starting camera...";

  const mindarThree = new MindARThree({
    container: document.querySelector("#ar-container"),
    imageTargetSrc: "./targets.mind"
  });

  const { renderer, scene, camera } = mindarThree;
  renderer.toneMapping = THREE.NoToneMapping;

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);

  const imageAspectRatio = 651 / 1024;

  targets.forEach((target, i) => {
    const anchor = mindarThree.addAnchor(target.index);
    const video = preloadedVideos[i];

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.colorSpace = THREE.SRGBColorSpace;
    videoTextures.push(videoTexture);

    const geometry = new THREE.PlaneGeometry(1, 1 / imageAspectRatio);
    const material = new THREE.MeshBasicMaterial({ map: videoTexture, transparent: true });
    const plane = new THREE.Mesh(geometry, material);
    anchor.group.add(plane);

    anchor.onTargetFound = () => {
      console.log(`[TARGET FOUND] index ${target.index} | video readyState: ${video.readyState} | paused: ${video.paused}`);
      video.play().catch(err => console.error(`[TARGET PLAY FAILED]`, err));
    };
    anchor.onTargetLost = () => video.pause();
  });

  await mindarThree.start();
  loadingEl.remove();

  renderer.setAnimationLoop(() => {
    // Tell Three.js to push fresh video frames to the GPU each tick
    videoTextures.forEach(t => {
      if (!t.image.paused) t.needsUpdate = true;
    });
    renderer.render(scene, camera);
  });
};

document.getElementById("start-btn").addEventListener("click", () => {
  document.getElementById("start-screen").style.display = "none";
  start();
});