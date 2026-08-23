/* Aturius training pack — generated 2026-08-23T05:46:56.345Z */
/* Put this file in your Azora folder and add in index.html BEFORE script.js:
   <script src="aturius-training-pack.js"></script>
*/
window.ATURIUS_TRAINING_PACK = [
  {
    "id": "tr_1787464007512",
    "triggers": [
      "What is your favorite game"
    ],
    "reply": "Ooh! I will say Azora Roleplay!",
    "at": 1787464007512
  }
];
window.getAturiusTraining = function () {
  try {
    if (window.ATURIUS_TRAINING_PACK && window.ATURIUS_TRAINING_PACK.length) return window.ATURIUS_TRAINING_PACK.slice();
    return JSON.parse(localStorage.getItem("azoraAturiusTraining") || "[]");
  } catch (e) { return []; }
};
