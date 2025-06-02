       function calculateAPUSHScore() {
            const mc = parseInt(document.getElementById('multipleChoice').value) || 0;
            const sa = parseInt(document.getElementById('shortAnswer').value) || 0;
            const dbq = parseInt(document.getElementById('dbq').value) || 0;
            const leq = parseInt(document.getElementById('leq').value) || 0;

            // Validate inputs
            if (mc > 55 || sa > 21 || dbq > 7 || leq > 6) {
                alert('Please enter valid scores within the maximum limits');
                return;
            }

            // Calculate weighted scores
            const mcWeight = (mc / 55) * 40;
            const saWeight = (sa / 21) * 20;
            const dbqWeight = (dbq / 7) * 25;
            const leqWeight = (leq / 6) * 15;

            // Calculate composite score
            const compositeScore = mcWeight + saWeight + dbqWeight + leqWeight;

            // Determine AP score
            let apScore;
            if (compositeScore >= 85) apScore = 5;
            else if (compositeScore >= 70) apScore = 4;
            else if (compositeScore >= 50) apScore = 3;
            else if (compositeScore >= 30) apScore = 2;
            else apScore = 1;

            // Display results
            const result = document.getElementById('result');
            const finalScore = document.getElementById('finalScore');
            const scoreExplanation = document.getElementById('scoreExplanation');

            finalScore.textContent = `${apScore} out of 5`;
            scoreExplanation.textContent = getScoreExplanation(apScore);
            result.style.display = 'block';
        }

        function getScoreExplanation(score) {
            const explanations = {
                5: "Extremely well qualified",
                4: "Well qualified",
                3: "Qualified",
                2: "Possibly qualified",
                1: "No recommendation"
            };
            return explanations[score];
        }