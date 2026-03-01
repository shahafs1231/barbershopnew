"""
Quick local test for the WhatsApp AI agent.
Simulates a full booking conversation without needing Meta API or a real phone.

Usage:
    cd backend
    python test_agent.py
"""

import asyncio
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=True)

# Verify key is loaded before importing the agent
api_key = os.getenv("ANTHROPIC_API_KEY", "")
if not api_key or api_key.startswith("sk-ant-..."):
    print("❌  ANTHROPIC_API_KEY not set.")
    print("    Add your real key to backend/.env:")
    print("    ANTHROPIC_API_KEY=sk-ant-api03-...")
    exit(1)

from whatsapp_bot import process_message

TEST_PHONE = "972501234567"

CONVERSATION = [
    "Hi! I want to book a haircut",
    "Haircut please, with Avi Cohen",
    "Next Sunday",
    "11:00",
    "My name is Yoni",
    "Pay at the shop",
    "Yes, confirm it",
]


async def run():
    print("=" * 55)
    print("  WhatsApp Agent — local test")
    print(f"  Simulated phone: +{TEST_PHONE}")
    print("=" * 55)

    for msg in CONVERSATION:
        print(f"\n👤  {msg}")
        reply = await process_message(TEST_PHONE, msg)
        print(f"🤖  {reply}")

    print("\n" + "=" * 55)
    print("  Test complete. Check barbershop.db for the booking.")
    print("=" * 55)


asyncio.run(run())
