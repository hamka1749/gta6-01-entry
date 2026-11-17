// SUNSET KEYS — the player character, a stylised islander built from boxes.
// A teal shirt, dark shorts, a straw hat and swinging legs: readable at a
// glance from the third-person camera, and cheap enough to animate by hand.

import * as THREE from 'three';

/** Build the character group. Its named parts are animated by player.js. */
export function buildCharacter() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x2e9e8f, roughness: 0.85 });
  const shorts = new THREE.MeshStandardMaterial({ color: 0x2c313a, roughness: 0.85 });
  const hat = new THREE.MeshStandardMaterial({ color: 0xe8d27a, roughness: 0.9 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), hat);
  brim.position.y = 1.94;
  group.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.16, 12), hat);
  crown.position.y = 2.02;
  group.add(crown);

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), shorts);
  leftLeg.geometry.translate(0, -0.36, 0);
  leftLeg.position.set(-0.16, 0.78, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), shorts);
  rightLeg.geometry.translate(0, -0.36, 0);
  rightLeg.position.set(0.16, 0.78, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.4), shoe);
  leftShoe.position.set(0, -0.72, 0.05);
  leftLeg.add(leftShoe);
  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.4), shoe);
  rightShoe.position.set(0, -0.72, 0.05);
  rightLeg.add(rightShoe);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), skin);
  leftArm.geometry.translate(0, -0.3, 0);
  leftArm.position.set(-0.42, 1.44, 0);
  leftArm.castShadow = true;
  group.add(leftArm);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), skin);
  rightArm.geometry.translate(0, -0.3, 0);
  rightArm.position.set(0.42, 1.44, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  return { group, leftLeg, rightLeg, leftArm, rightArm };
}
