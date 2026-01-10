from rest_framework import serializers
from .models import Post

class PostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ['id', 'author', 'title', 'content', 'image_url', 'created_at']
        
     
    def validate(self, attrs):
        content = attrs.get('content')
        image_url = attrs.get('image_url')
        if not content and not image_url:
            raise serializers.ValidationError("Either content or image_url must be provided.")
        return attrs
            
            