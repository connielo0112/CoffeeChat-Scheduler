import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from .models import ChatMessage
from django.utils import timezone

""" 
1. Connect users to WebSocket chat rooms
2. Receive chat messages
3. Save messages to database
4. Send messages and notifications to other users via WebSocket
"""

class ChatConsumer(AsyncWebsocketConsumer):

    # Connect to WebSocket (join room group)
    async def connect(self):

        # extracts the room_name from the URL
        # This is used to identify the chat room the user is joining
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'chat_{self.room_name}'

        #  subscribes the client to the chat room group
        # This allows the user to receive messages from other users in the same chat room
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        # If the room_name is "global", subscribe to the global group 
        # This allows the user to receive notifications for new messages
        # from other users in the global chat room
        if self.room_name == "global":
            await self.channel_layer.group_add(
                "chat_global",
                self.channel_name
            )

        await self.accept()

    # Disconnect from WebSocket (leave room group)
    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive message from WebSocket
    async def receive(self, text_data):

        try:
            # Parse the incoming message
            # The message is expected to be a JSON string containing the message, sender_id, and receiver_id
            # This is used to identify the sender and receiver of the message
            text_data_json = json.loads(text_data)
            message = text_data_json['message']
            sender_id = text_data_json['sender_id']
            receiver_id = text_data_json['receiver_id']

            # Save message to database
            message_obj = await self.save_message(sender_id, receiver_id, message)

            # Get sender information
            # This is used to identify the sender of the message
            # Get the sender's name and timestamp
            sender_name = await self.get_user_name(sender_id)
            timestamp = await self.get_timestamp()

            # Broadcast message to everyone in the chat room
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'sender_id': sender_id,
                    'sender_name': sender_name,
                    'timestamp': timestamp
                }
            )
            
            # Send notification to global group for the receiver
            # Create a preview of the message (limit to 30 chars)
            message_preview = message[:30] + "..." if len(message) > 30 else message

            # Sends the message to the global group
            # This allows other users to receive notifications for new messages 
            await self.channel_layer.group_send(
                'chat_global',  # This matches the WebSocket URL /ws/chat/global/
                {
                    'type': 'new_message_notification',
                    'sender_id': sender_id,
                    'receiver_id': receiver_id,
                    'sender_name': sender_name,
                    'message_preview': message_preview,
                    'room_name': self.room_name,
                    'timestamp': timestamp
                }
            )
        except Exception as e:
            print(f"Error processing message: {e}")

    # Receive message from room group
    async def chat_message(self, event):
        message = event['message']
        sender_id = event['sender_id']
        sender_name = event['sender_name']
        timestamp = event['timestamp']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': message,
            'sender_id': sender_id,
            'sender_name': sender_name,
            'timestamp': timestamp
        }))
    
    # Handle new message notification events
    async def new_message_notification(self, event):

        # Send notification to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'new_message_notification',
            'sender_id': event['sender_id'],
            'receiver_id': event.get('receiver_id'),
            'sender_name': event['sender_name'],
            'message_preview': event['message_preview'],
            'room_name': event['room_name'],
            'timestamp': event['timestamp']
        }))

    @database_sync_to_async
    def save_message(self, sender_id, receiver_id, message):
        try:
            sender = User.objects.get(id=sender_id)
            receiver = User.objects.get(id=receiver_id)
            
            chat_message = ChatMessage.objects.create(
                sender=sender,
                receiver=receiver,
                message=message,
                is_read=False  # Make sure this is set to False for new messages
            )
            return chat_message
        except Exception as e:
            print(f"Error saving message to database: {e}")
            return None

    @database_sync_to_async
    def get_user_name(self, user_id):
        try:
            user = User.objects.get(id=user_id)
            return f"{user.first_name} {user.last_name}"
        except User.DoesNotExist:
            return "Unknown User"
    
    @database_sync_to_async
    def get_timestamp(self):
        return timezone.now().isoformat()
    
