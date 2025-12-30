
// Client-side proxy: call the serverless API which holds the Gemini key.
export const generateSmartSchedule = async (prompt: string, year: number) => {
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, year })
    });

    if (!res.ok) {
      console.error('Server error:', await res.text());
      return [];
    }

    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error('Fetch error:', err);
    return [];
  }
};
