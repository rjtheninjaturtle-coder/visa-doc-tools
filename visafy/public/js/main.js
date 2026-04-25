document.addEventListener('DOMContentLoaded', () => {
    
    // Country Checklist Logic
    const countrySelect = document.getElementById('countrySelect');
    const checklistResult = document.getElementById('checklistResult');

    if (countrySelect && checklistResult) {
        
        // Dummy data database
        const checklists = {
            us: [
                "Valid Passport (at least 6 months validity)",
                "DS-160 Confirmation Page",
                "Application Fee Payment Receipt",
                "2x2 inch Photo (White background)",
                "Interview Appointment Letter"
            ],
            uk: [
                "Valid Passport",
                "Online Visa Application form printed and signed",
                "Proof of sufficient funds (Bank statements for 6 months)",
                "Details of accommodation and return flights",
                "Letter from employer (if employed)"
            ],
            schengen: [
                "Completed Visa Application Form",
                "Two identical recent passport photos",
                "Valid Passport (with at least 2 blank pages)",
                "Round trip reservation or itinerary",
                "Travel Health Insurance (min coverage €30,000)"
            ]
        };

        countrySelect.addEventListener('change', (e) => {
            const selected = e.target.value;
            
            if (selected && checklists[selected]) {
                const items = checklists[selected].map(item => `<li>${item}</li>`).join('');
                checklistResult.innerHTML = `
                    <h3>Required Documents:</h3>
                    <ul>${items}</ul>
                `;
            } else {
                checklistResult.innerHTML = '';
            }
        });
    }

    // You can add Photo Editor and PDF Tool logic here later using libraries like Cropper.js or pdf-lib.
    console.log("Visafy frontend initialized.");
});
