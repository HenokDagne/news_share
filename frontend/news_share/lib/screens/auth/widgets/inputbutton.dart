import 'package:flutter/material.dart';

class InputButton extends StatefulWidget {
  final GlobalKey<FormState> formKey;
  final TextEditingController dobController;
  final TextEditingController genderController;
  final VoidCallback onSubmit;

  const InputButton({
    super.key,
    required this.formKey,
    required this.dobController,
    required this.genderController,
    required this.onSubmit,
  });

  @override
  State<InputButton> createState() => _InputButtonState();
}

class _InputButtonState extends State<InputButton> {
  String? selectedMonth;
  String? selectedDay;
  String? selectedYear;
  String selectedGender = 'female';

  final List<String> months = const [
    'Month', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  final List<String> days = List.generate(31, (i) => '${i + 1}');
  final List<String> years = List.generate(80, (i) => '${2026 - 18 - i}');

  @override
  void initState() {
    super.initState();
    selectedMonth = months[0];
    selectedDay = days[0];
    selectedYear = years[0];
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Date of Birth', style: TextStyle(fontSize: 12, color: Color(0xFF8E8E8E))),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                value: selectedMonth,
                decoration: _dropdownDecoration(),
                items: months
                    .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                    .toList(),
                onChanged: (v) {
                  setState(() => selectedMonth = v);
                  _updateDOB();
                },
                validator: (v) => v == 'Month' ? 'Select month' : null,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: DropdownButtonFormField<String>(
                value: selectedDay,
                decoration: _dropdownDecoration(),
                items: days
                    .map((d) => DropdownMenuItem(value: d, child: Text(d)))
                    .toList(),
                onChanged: (v) {
                  setState(() => selectedDay = v);
                  _updateDOB();
                },
                validator: (v) => v == '1' ? 'Select day' : null,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: DropdownButtonFormField<String>(
                value: selectedYear,
                decoration: _dropdownDecoration(),
                items: years
                    .map((y) => DropdownMenuItem(value: y, child: Text(y)))
                    .toList(),
                onChanged: (v) {
                  setState(() => selectedYear = v);
                  _updateDOB();
                },
                validator: (v) => v == years[0] ? 'Select year' : null,
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        const Text('Gender', style: TextStyle(fontSize: 12, color: Color(0xFF8E8E8E))),
        Row(
          children: [
            Radio<String>(
              value: 'female',
              groupValue: selectedGender,
              onChanged: (v) {
                setState(() => selectedGender = v!);
                widget.genderController.text = v!;
              },
            ),
            const Text('Female'),
            const SizedBox(width: 12),
            Radio<String>(
              value: 'male',
              groupValue: selectedGender,
              onChanged: (v) {
                setState(() => selectedGender = v!);
                widget.genderController.text = v!;
              },
            ),
            const Text('Male'),
            const SizedBox(width: 12),
            Radio<String>(
              value: 'custom',
              groupValue: selectedGender,
              onChanged: (v) {
                setState(() => selectedGender = v!);
                widget.genderController.text = v!;
              },
            ),
            const Text('Custom'),
          ],
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0095F6),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            onPressed: widget.onSubmit, // 👈 Calls handler
            child: const Text(
              'Sign Up',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ],
    );
  }

  InputDecoration _dropdownDecoration() => InputDecoration(
        filled: true,
        fillColor: const Color(0xFFF8F8F8),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE4E4E4)),
        ),
      );

  void _updateDOB() {
    if (selectedMonth != months[0] && 
        selectedDay != '1' && 
        selectedYear != years[0]) {
      widget.dobController.text = '$selectedDay/$selectedMonth/$selectedYear';
    }
  }
}
