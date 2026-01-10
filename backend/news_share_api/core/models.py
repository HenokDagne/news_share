from django.contrib.auth.models import AbstractUser
from django.db import models

class CustomUser(AbstractUser):
    username = models.CharField(max_length=150, unique=True)  # Public display username
    email = models.EmailField(unique=True)  # Login field
    
    phone = models.CharField(max_length=20, blank=True, null=True)
    bio = models.TextField(blank=True, null=True)
    name = models.CharField(max_length=200, blank=True, null=True)
    date_birth = models.DateField(default="2000-01-01")


    GENDER_CHOICES = (
        ('M', 'Male'),
        ('F', 'Female'),
    )
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True, null=True)

    USERNAME_FIELD = "email"          # login by email
    REQUIRED_FIELDS = ["username"]    # still require username during create-superuser

    def __str__(self):
        return self.username

