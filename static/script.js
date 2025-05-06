function showSection(sectionId) {
    console.log('showSection called for:', sectionId);
    const sections = ['user-perspective', 'developer-perspective'];
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (section) {
            section.style.display = id === sectionId ? 'block' : 'none';
        } else {
            console.warn(`Section element not found: ${id}`);
        }
    });
    const links = document.querySelectorAll('nav a');
    links.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${sectionId}`);
    });
    const sectionElement = document.getElementById(sectionId);
    if (sectionElement) {
        sectionElement.scrollIntoView({ behavior: 'smooth' });
    } else {
        console.warn(`Section element for scrolling not found: ${sectionId}`);
    }
}

function showUploadForm() {
    console.log('showUploadForm called');
    const uploadForm = document.getElementById('upload-form');
    const analyticsDiv = document.getElementById('analytics');
    const inputSection = document.querySelector('.input-section');
    const errorDiv = document.getElementById('error');
    if (uploadForm && analyticsDiv && inputSection && errorDiv) {
        uploadForm.style.display = 'block';
        analyticsDiv.style.display = 'none';
        inputSection.style.display = 'none';
        errorDiv.textContent = '';
    } else {
        console.error('Missing elements:', { uploadForm, analyticsDiv, inputSection, errorDiv });
    }
}

function fetchAnalytics() {
    console.log('fetchAnalytics called');
    const videoId = document.getElementById('video-id').value.trim();
    const errorDiv = document.getElementById('error');
    const analyticsDiv = document.getElementById('analytics');
    const uploadForm = document.getElementById('upload-form');
    const inputSection = document.querySelector('.input-section');

    if (!errorDiv || !analyticsDiv || !uploadForm || !inputSection) {
        console.error('Missing elements:', { errorDiv, analyticsDiv, uploadForm, inputSection });
        errorDiv.textContent = 'Internal error: UI elements missing';
        return;
    }

    if (!videoId || isNaN(videoId) || videoId <= 0) {
        console.error('Invalid video ID:', videoId);
        errorDiv.textContent = 'Please enter a valid numeric Video ID';
        analyticsDiv.style.display = 'none';
        uploadForm.style.display = 'none';
        inputSection.style.display = 'block';
        return;
    }

    console.log('Fetching analytics for video ID:', videoId);
    fetch(`/analytics/${videoId}`, { cache: 'no-store' })
        .then(response => {
            console.log('Fetch response:', response.status, response.statusText);
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`Failed to fetch analytics: ${response.status} ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Analytics data:', JSON.stringify(data, null, 2));
            errorDiv.textContent = '';
            analyticsDiv.classList.add('visible');
            analyticsDiv.style.display = 'block';
            uploadForm.style.display = 'none';
            inputSection.style.display = 'block';
            console.log('Analytics div display:', analyticsDiv.style.display);
            populateAnalytics(data);
        })
        .catch(error => {
            console.error('Fetch error:', error.message);
            errorDiv.textContent = error.message;
            analyticsDiv.style.display = 'none';
            uploadForm.style.display = 'none';
            inputSection.style.display = 'block';
        });
}

function populateAnalytics(data) {
    console.log('Populating analytics with data:', data);

    function updateElement(id, content) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = content;
        } else {
            console.error(`Element not found: ${id}`);
        }
    }

    function updateElementHTML(id, html) {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = html;
        } else {
            console.error(`Element not found for innerHTML: ${id}`);
        }
    }

    // User Perspective
    updateElement('input-file', data.input_file || 'N/A');
    updateElement('input-size', data.input_size ? data.input_size.toFixed(2) : 'N/A');
    if (data.final_output && data.final_output.file) {
        const finalPath = data.final_output.file.replace(/^output\//, '');
        updateElementHTML('final-output-player', `
            <video controls class="w-full max-w-md" src="/output/${finalPath}">
                Your browser does not support the video tag.
            </video>
        `);
    } else {
        updateElementHTML('final-output-player', 'Not available');
    }
    updateElement('final-size', data.final_output && data.final_output.size_mb ? data.final_output.size_mb.toFixed(2) : 'N/A');
    updateElement('total-scenes', data.scenes ? data.scenes.length : '0');
    updateElement('selected-scenes', data.summary_clips ? data.summary_clips.length : '0');

    // Scene Details Table
    const sceneTableBody = document.getElementById('scene-table');
    if (sceneTableBody) {
        console.log('Populating scene table with clips:', data.summary_clips);
        sceneTableBody.innerHTML = '';
        if (data.summary_clips && Array.isArray(data.summary_clips)) {
            data.summary_clips.forEach((clip, index) => {
                const sceneNum = index + 1;
                const transcript = data.transcripts && data.transcripts[`scene_${sceneNum}`]?.text || 'N/A';
                const audioFile = data.audio_files && data.audio_files[`scene_${sceneNum}`]?.file;
                const audioPath = audioFile ? audioFile.replace(/^output\//, '') : null;
                const audioPlayer = audioPath 
                    ? `<audio controls src="/output/${audioPath}" class="w-full max-w-xs"></audio>` 
                    : 'N/A';
                const row = `
                    <tr>
                        <td class="border p-2">${sceneNum}</td>
                        <td class="border p-2">${clip.start ? clip.start.toFixed(2) : 'N/A'}</td>
                        <td class="border p-2">${clip.end ? clip.end.toFixed(2) : 'N/A'}</td>
                        <td class="border p-2">${clip.start && clip.end ? (clip.end - clip.start).toFixed(2) : 'N/A'}</td>
                        <td class="border p-2">${transcript.substring(0, 50)}${transcript.length > 50 ? '...' : ''}</td>
                        <td class="border p-2">${audioPlayer}</td>
                    </tr>
                `;
                sceneTableBody.innerHTML += row;
            });
        } else {
            sceneTableBody.innerHTML = '<tr><td colspan="6" class="border p-2 text-center">No scenes available</td></tr>';
        }
    } else {
        console.error('Scene table body not found');
    }

    // Processing Times Table
    const processingTableBody = document.getElementById('processing-table');
    if (processingTableBody) {
        console.log('Populating processing table with steps:', data.processing_steps);
        processingTableBody.innerHTML = '';
        if (data.processing_steps && typeof data.processing_steps === 'object') {
            for (const [step, details] of Object.entries(data.processing_steps)) {
                const stepName = step.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const row = `
                    <tr>
                        <td class="border p-2">${stepName}</td>
                        <td class="border p-2">${details.time_taken ? details.time_taken.toFixed(2) : 'N/A'}</td>
                        <td class="border p-2">${JSON.stringify(details, null, 2).replace(/{|}/g, '')}</td>
                    </tr>
                `;
                processingTableBody.innerHTML += row;
            }
        } else {
            processingTableBody.innerHTML = '<tr><td colspan="3" class="border p-2 text-center">No processing steps available</td></tr>';
        }
    } else {
        console.error('Processing table body not found');
    }

    // File Sizes Table
    const fileSizesTableBody = document.getElementById('file-sizes-table');
    if (fileSizesTableBody) {
        console.log('Populating file sizes table');
        fileSizesTableBody.innerHTML = '';
        fileSizesTableBody.innerHTML += `
            <tr>
                <td class="border p-2">Input</td>
                <td class="border p-2">${data.input_file || 'N/A'}</td>
                <td class="border p-2">${data.input_size ? data.input_size.toFixed(2) : 'N/A'}</td>
            </tr>
        `;
        if (data.final_output && data.final_output.file) {
            fileSizesTableBody.innerHTML += `
                <tr>
                    <td class="border p-2">Final Output</td>
                    <td class="border p-2">${data.final_output.file}</td>
                    <td class="border p-2">${data.final_output.size_mb ? data.final_output.size_mb.toFixed(2) : 'N/A'}</td>
                </tr>
            `;
        }
        if (data.audio_files && typeof data.audio_files === 'object') {
            for (const [scene, audio] of Object.entries(data.audio_files)) {
                fileSizesTableBody.innerHTML += `
                    <tr>
                        <td class="border p-2">Audio (${scene})</td>
                        <td class="border p-2">${audio.file || 'N/A'}</td>
                        <td class="border p-2">${audio.size_mb ? audio.size_mb.toFixed(2) : 'N/A'}</td>
                    </tr>
                `;
            }
        }
        if (data.video_clips && Array.isArray(data.video_clips)) {
            data.video_clips.forEach(clip => {
                fileSizesTableBody.innerHTML += `
                    <tr>
                        <td class="border p-2">Video Clip (Scene ${clip.scene_number || 'N/A'})</td>
                        <td class="border p-2">${clip.file || 'N/A'}</td>
                        <td class="border p-2">${clip.size_mb ? clip.size_mb.toFixed(2) : 'N/A'}</td>
                    </tr>
                `;
            });
        }
    } else {
        console.error('File sizes table body not found');
    }

    // Logs
    updateElement('logs', data.logs && Array.isArray(data.logs) && data.logs.length ? data.logs.join('\n') : 'No logs available');
}

document.getElementById('video-upload-form')?.addEventListener('submit', function(event) {
    event.preventDefault();
    console.log('Video upload form submitted');
    const fileInput = document.getElementById('video-file');
    const statusDiv = document.getElementById('upload-status');
    const errorDiv = document.getElementById('error');
    const progressBar = document.getElementById('progress-bar');
    const progressContainer = document.getElementById('upload-progress');

    if (!fileInput || !statusDiv || !errorDiv || !progressBar || !progressContainer) {
        console.error('Missing upload form elements:', { fileInput, statusDiv, errorDiv, progressBar, progressContainer });
        errorDiv.textContent = 'Internal error: Upload form elements missing';
        return;
    }

    if (!fileInput.files.length) {
        console.error('No file selected');
        statusDiv.textContent = 'Please select a video file';
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    statusDiv.textContent = 'Uploading...';
    errorDiv.textContent = '';
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/summarize/', true);

    xhr.upload.onprogress = function(event) {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            progressBar.style.width = `${percentComplete}%`;
            console.log(`Upload progress: ${percentComplete.toFixed(2)}%`);
        }
    };

    xhr.onload = function() {
        progressContainer.classList.add('hidden');
        if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            console.log('Upload response:', data);
            statusDiv.textContent = `Video uploaded successfully! Video ID: ${data.video_id}`;
            document.getElementById('video-id').value = data.video_id;
            fetchAnalytics();
        } else {
            console.error('Upload failed:', xhr.status, xhr.statusText);
            statusDiv.textContent = '';
            errorDiv.textContent = `Error: ${xhr.statusText || 'Upload failed'}`;
        }
    };

    xhr.onerror = function() {
        console.error('Upload network error');
        progressContainer.classList.add('hidden');
        statusDiv.textContent = '';
        errorDiv.textContent = 'Error: Network error during upload';
    };

    xhr.send(formData);
});

showSection('user-perspective');