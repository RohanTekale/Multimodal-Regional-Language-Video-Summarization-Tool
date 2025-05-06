function showSection(sectionId) {
    console.log('showSection called for:', sectionId);
    const sections = ['user-perspective', 'developer-perspective', 'graphical-analysis'];
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

    // Processing Efficiency
    const totalProcessingTime = data.processing_steps ? Object.values(data.processing_steps).reduce((sum, step) => sum + (step.time_taken || 0), 0) : 0;
    const sceneCount = data.scenes ? data.scenes.length : 1;
    const efficiency = totalProcessingTime / sceneCount;
    updateElement('processing-efficiency', efficiency ? efficiency.toFixed(2) : 'N/A');

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
                const importanceScore = clip.importance_score ? clip.importance_score.toFixed(2) : 'N/A';
                const row = `
                    <tr>
                        <td class="border p-2">${sceneNum}</td>
                        <td class="border p-2">${clip.start ? clip.start.toFixed(2) : 'N/A'}</td>
                        <td class="border p-2">${clip.end ? clip.end.toFixed(2) : 'N/A'}</td>
                        <td class="border p-2">${clip.start && clip.end ? (clip.end - clip.start).toFixed(2) : 'N/A'}</td>
                        <td class="border p-2">${importanceScore}</td>
                        <td class="border p-2">${transcript.substring(0, 50)}${transcript.length > 50 ? '...' : ''}</td>
                        <td class="border p-2">${audioPlayer}</td>
                    </tr>
                `;
                sceneTableBody.innerHTML += row;
            });
        } else {
            sceneTableBody.innerHTML = '<tr><td colspan="7" class="border p-2 text-center">No scenes available</td></tr>';
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

    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        console.error('Chart.js not loaded. Charts will not be rendered.');
        return;
    }

    // Scene Duration Chart
    try {
        const sceneDurationCtx = document.getElementById('scene-duration-chart')?.getContext('2d');
        if (!sceneDurationCtx) throw new Error('Scene duration chart canvas not found');
        const sceneDurations = data.summary_clips && Array.isArray(data.summary_clips) ? data.summary_clips.map((clip, index) => ({
            label: `Scene ${index + 1}`,
            duration: clip.end && clip.start ? (clip.end - clip.start).toFixed(2) : 0
        })) : [];
        new Chart(sceneDurationCtx, {
            type: 'bar',
            data: {
                labels: sceneDurations.map(item => item.label),
                datasets: [{
                    label: 'Duration (s)',
                    data: sceneDurations.map(item => item.duration),
                    backgroundColor: '#14B8A6',
                    borderColor: '#0D9488',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Duration (seconds)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Scenes'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error rendering scene duration chart:', error.message);
    }

    // Processing Time Breakdown Chart
    try {
        const processingTimeCtx = document.getElementById('processing-time-chart')?.getContext('2d');
        if (!processingTimeCtx) throw new Error('Processing time chart canvas not found');
        const processingSteps = data.processing_steps && typeof data.processing_steps === 'object' ? Object.entries(data.processing_steps).map(([step, details]) => ({
            label: step.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            time: details.time_taken || 0
        })) : [];
        new Chart(processingTimeCtx, {
            type: 'pie',
            data: {
                labels: processingSteps.map(item => item.label),
                datasets: [{
                    data: processingSteps.map(item => item.time),
                    backgroundColor: ['#14B8A6', '#1E3A8A', '#EF4444', '#F59E0B', '#8B5CF6'],
                    borderColor: '#FFFFFF',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: context => `${context.label}: ${context.raw.toFixed(2)}s`
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error rendering processing time chart:', error.message);
    }

    // File Size Comparison Chart
    try {
        const fileSizeCtx = document.getElementById('file-size-chart')?.getContext('2d');
        if (!fileSizeCtx) throw new Error('File size chart canvas not found');
        const fileSizes = [];
        if (data.input_size) fileSizes.push({ label: 'Input', size: data.input_size });
        if (data.final_output && data.final_output.size_mb) fileSizes.push({ label: 'Final Output', size: data.final_output.size_mb });
        if (data.audio_files && typeof data.audio_files === 'object') {
            Object.entries(data.audio_files).forEach(([scene, audio]) => {
                if (audio.size_mb) fileSizes.push({ label: `Audio (${scene})`, size: audio.size_mb });
            });
        }
        if (data.video_clips && Array.isArray(data.video_clips)) {
            data.video_clips.forEach(clip => {
                if (clip.size_mb) fileSizes.push({ label: `Video Clip (Scene ${clip.scene_number || 'N/A'})`, size: clip.size_mb });
            });
        }
        new Chart(fileSizeCtx, {
            type: 'bar',
            data: {
                labels: fileSizes.map(item => item.label),
                datasets: [{
                    label: 'Size (MB)',
                    data: fileSizes.map(item => item.size),
                    backgroundColor: '#1E3A8A',
                    borderColor: '#1E40AF',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Size (MB)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Files'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error rendering file size chart:', error.message);
    }

    // Transcript Word Cloud
    try {
        const wordCloudDiv = document.getElementById('word-cloud');
        if (wordCloudDiv && data.transcripts && typeof data.transcripts === 'object') {
            const wordFreq = {};
            Object.values(data.transcripts).forEach(transcript => {
                if (transcript && typeof transcript.text === 'string') {
                    const words = transcript.text.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/);
                    words.forEach(word => {
                        if (word.length > 3) { // Ignore short words
                            wordFreq[word] = (wordFreq[word] || 0) + 1;
                        }
                    });
                }
            });
            const sortedWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 20);
            wordCloudDiv.innerHTML = sortedWords.length > 0 
                ? sortedWords.map(([word, count]) => {
                    const fontSize = Math.min(32, 16 + count * 4);
                    return `<span style="font-size: ${fontSize}px; margin: 4px; color: #1E3A8A;">${word}</span>`;
                }).join(' ')
                : 'No significant words found in transcripts';
        } else {
            wordCloudDiv.innerHTML = 'No transcript data available';
            console.warn('Word cloud skipped: No valid transcript data');
        }
    } catch (error) {
        console.error('Error rendering word cloud:', error.message);
    }
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