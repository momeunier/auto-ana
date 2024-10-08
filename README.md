# Hookalyzer 

Hookalyzer is a Proof of Concept of Automated Creative Analysis using Gemini 1.5 Pro

```
git clone https://github.com/shook-digital/hookalyzer.git
```

Environment compiled with webpack

Go to https://aistudio.google.com to get an API key.

copy .env.example to .env and insert your API key from Google 

launch in two terminals
Terminal 1
```
npm start
```
Terminal 2
```
node apps.js
```

TODO: 
* fix the spin.js
* look at security
* make sure files are named in a way Gemini can understand the prompt (right now, file names are random and Gemini cannot make sense of them)
* understand where files are going

##########################################################################################

Example of prompt:

```
## Objective
Analyze and evaluate modular TikTok UGC (User-Generated Content) performance ad scripts based on their potential to drive engagement and conversions while resonating with the TikTok audience.

## What Makes a Great Performance-Driven UGC Video on TikTok

Before beginning the analysis, consider these key aspects of highly effective TikTok UGC performance ads:

1. Authentic and Relatable Content:
   - Feels genuine and unscripted
   - Creator appears natural and comfortable
   - Reflects real-life experiences with the product/service

2. Strong Opening (0-3 seconds):
   - Captures attention immediately
   - Uses pattern interrupts or curiosity gaps
   - Clearly communicates value proposition

3. Concise and Focused Messaging:
   - Keeps videos short (15-60 seconds, ideally)
   - Delivers key points efficiently
   - Maintains a clear, singular focus

4. Compelling Storytelling:
   - Uses before-and-after scenarios
   - Demonstrates problem-solving
   - Creates emotional connection

5. Product Demonstration:
   - Shows the product in action
   - Highlights key features and benefits
   - Provides social proof through user experience

6. TikTok-Native Elements:
   - Uses popular sounds, music, or trending audio
   - Incorporates platform-specific features (e.g., text overlays, transitions)
   - Follows current TikTok trends and formats

7. Strong Call-to-Action (CTA):
   - Clear and compelling CTA
   - Creates urgency or FOMO (Fear of Missing Out)
   - Guides viewers on next steps

8. Visually Engaging:
   - Uses dynamic visuals or camera movements
   - Incorporates text overlays for key points
   - Ensures good lighting and clear audio

9. Mobile-First Approach:
   - Optimized for vertical viewing
   - Uses large, readable text
   - Designs for sound-on and sound-off viewing

10. Performance Optimization:
    - Includes persuasive elements (e.g., social proof, scarcity)
    - Addresses potential objections
    - Aligns with specific campaign goals (e.g., clicks, conversions)

11. Audience Targeting:
    - Speaks directly to the target demographic
    - Uses language and references relevant to the audience
    - Addresses specific pain points or desires of the target market

12. Brand Alignment:
    - Maintains consistency with brand voice and values
    - Integrates branding elements subtly but effectively
    - Builds brand recognition and trust

## Instructions
Analyze each set of ad script modules, considering their structure and how they can be mixed and matched. Evaluate them based on the criteria below, providing a score from 1-10 for each category and a brief explanation for your rating. Consider how well each script aligns with the characteristics of great performance-driven UGC videos described above. 

## Evaluation Criteria

1. Opening Impact (1-10):
   - How effectively does the script start, regardless of whether it uses a traditional "hook"?
   - Does the opening grab attention and encourage viewers to keep watching?

2. Value Proposition Clarity (1-10):
   - How clearly do the scripts communicate the product/service benefits?
   - Is the unique selling point evident across different modules?

3. TikTok Platform Fit (1-10):
   - How well do the scripts utilize TikTok-specific features, trends, or language?
   - Would they feel native to the platform?

4. UGC Authenticity (1-10):
   - How genuine and relatable do the scripts feel?
   - Do they sound like real users sharing their experiences?

5. Structural Flexibility and Modularity (1-10):
   - How adaptable is the script structure?
   - Can different sections be easily rearranged or combined while maintaining coherence?

6. Call-to-Action Effectiveness (1-10):
   - How clear and compelling are the calls-to-action?
   - Are they well-integrated into the script, regardless of its structure?

7. Engagement Potential (1-10):
   - How likely is the content to encourage likes, comments, or shares?
   - Do the scripts invite viewer participation or replication?

8. Conversion Potential (1-10):
   - How effectively do the scripts guide viewers towards the desired action (clicks, purchases, etc.)?
   - Is there a clear path from engagement to conversion, regardless of script structure?

9. Target Audience Alignment (1-10):
   - How well do the scripts speak to the intended audience?
   - Is the language and tone appropriate for the target demographic?

10. Overall Performance Potential (1-10):
    - Considering all factors, how likely are these scripts to drive both engagement and conversions?
    - Do they strike a balance between being entertaining and action-oriented?
```
