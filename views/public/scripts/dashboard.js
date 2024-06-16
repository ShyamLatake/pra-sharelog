import axios from 'axios';

      const micButtons = document.querySelectorAll('.mic-button');

      micButtons.forEach(button => {
          button.addEventListener('click', startRecording);
      });

      const stopButtons = document.querySelectorAll('.three-lines');

      stopButtons.forEach(button => {
        button.addEventListener('click', function() {
          stopRecording(button.id); // Pass the button ID to the startRecording function
    });
      });

      let mediaRecorder; // Variable to store the MediaRecorder object
      let chunks = []; // Array to store recorded audio chunks

      // Function to handle recording when the mic button is clicked

      function startRecording() {
          chunks = [];
          navigator.mediaDevices.getUserMedia({ audio: true })
              .then(stream => {
                  mediaRecorder = new MediaRecorder(stream);

                  // Event listener for dataavailable event
                  mediaRecorder.ondataavailable = function(e) {
                      chunks.push(e.data);
                  };

                  // Event listener for stop event
                  mediaRecorder.onstop = function() {
                      const audioBlob = new Blob(chunks, { type: 'audio/wav' });
                      const audioUrl = URL.createObjectURL(audioBlob);
                      console.log('Recording stopped. Audio URL:', audioUrl);
                      // const audio = new Audio(audioUrl);
                      // audio.controls = true; // Add controls for playback
                      // document.body.appendChild(audio); // Append the audio element to the document body
                      // audio.play(); // Start playback
                  };

                  // Start recording
                  mediaRecorder.start();

                  console.log('Recording started...');
              })
              .catch(err => {
                  console.error('Error accessing microphone:', err);
              });
      }

      async function sendAudioToBackend(buttonId, audioData) {
          try {
              const response = await axios.post('/saveAudio', {
                  buttonId: buttonId,
                  audio: audioData
              });
              console.log('Recording sent to backend successfully:', response.data);
          } catch (error) {
              console.error('Error sending recording to backend:', error);
          }
      }

      function stopRecording(buttonId) {
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
              console.log('Recording stopped for: ', buttonId);

              // Convert the recorded audio chunks to a single audio Buffer
              const audioBlob = new Blob(chunks, { type: 'audio/wav' });
              const reader = new FileReader();
              reader.readAsDataURL(audioBlob);
              reader.onloadend = function() {
                  const audioData = reader.result.split(',')[1]; // Extract base64-encoded audio data
                  sendAudioToBackend(buttonId, audioData);
              };

          } else {
              console.warn('No active recording to stop.');
          }
      }
